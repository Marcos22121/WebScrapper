import puppeteer from "puppeteer-core";
import fs from "fs";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeVariosProductos(browser, page, urlCategoria, nombreCategoria, limite = 40) {
  console.log(`🔎 Scrapeando categoría: ${nombreCategoria} -> ${urlCategoria}`);
  await page.goto(urlCategoria, { waitUntil: "networkidle2", timeout: 60000 });

  const productSelector = ".diaio-search-result-0-x-galleryItem";
  let allProducts = [];
  let hasMore = true;

  while (hasMore && allProducts.length < limite) {
    try {
      await page.waitForSelector(productSelector, { timeout: 15000 });
    } catch {
      console.log("⏹ No se encontraron productos en la página (timeout).");
      break;
    }

    const pageProducts = await page.evaluate((prodSelector, categoria) => {
      const wrappers = Array.from(document.querySelectorAll(prodSelector));
      return wrappers.map((wrapper) => {
        const nombre = wrapper.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText?.trim() ?? null;
        const marca = wrapper.querySelector(".vtex-store-components-3-x-productBrandName")?.innerText?.trim() ?? null;
        const precio =
          wrapper.querySelector(".diaio-store-5-x-sellingPriceValue")?.innerText?.trim() ??
          wrapper.querySelector(".vtex-product-price-1-x-sellingPriceValue")?.innerText?.trim() ??
          null;
        const imagen = wrapper.querySelector("img")?.src ?? null;
        let url_producto = wrapper.querySelector("a")?.getAttribute("href") ?? null;
        if (url_producto) {
          try { url_producto = new URL(url_producto, location.origin).href; } catch {}
        }
        return {
          nombre,
          marca,
          categoria,
          descripcion: null,
          precio,
          precio_regular: null,
          precio_sin_impuestos: null,
          imagen,
          url_producto,
        };
      });
    }, productSelector, nombreCategoria);

    pageProducts.forEach((p) => {
      const exists = p.url_producto
        ? allProducts.some((ap) => ap.url_producto === p.url_producto)
        : allProducts.some((ap) => ap.nombre === p.nombre && ap.imagen === p.imagen);
      if (!exists) allProducts.push(p);
    });

    if (allProducts.length >= limite) break;

    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => {
        const t = (b.innerText || "").trim();
        const visible = b.offsetParent !== null && b.offsetWidth > 0 && b.offsetHeight > 0;
        return visible && t.includes("Mostrar más");
      });
      if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); return true; }
      return false;
    });

    if (!clicked) { hasMore = false; break; }

    await sleep(1000); // espera que carguen nuevos productos
  }

  for (const product of allProducts.slice(0, limite)) {
    if (!product.url_producto) continue;
    try {
      const prodPage = await browser.newPage();
      await prodPage.goto(product.url_producto, { waitUntil: "domcontentloaded", timeout: 40000 });

      try {
        await prodPage.waitForSelector(".diaio-custom-prices-without-taxes-0-x-pricesWithoutTaxes__texto", { timeout: 10000 });
      } catch {}

      const detalles = await prodPage.evaluate(() => {
        const descripcion = document.querySelector(".vtex-store-components-3-x-content.h-auto")?.innerText?.trim() ?? null;
        const marca = document.querySelector(".vtex-store-components-3-x-productBrandName")?.innerText?.trim() ?? null;
        const precio_regular = document.querySelector(".diaio-store-5-x-listPriceValue.strike")?.innerText?.trim() ?? null;
        const span = document.querySelector(".diaio-custom-prices-without-taxes-0-x-pricesWithoutTaxes__texto");
        const precio_sin_impuestos = span ? span.innerText.trim() : null;
        return { descripcion, marca, precio_regular, precio_sin_impuestos };
      });

      Object.assign(product, detalles);
      await prodPage.close();
      await sleep(300);
    } catch {}
  }

  return allProducts.slice(0, limite);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

  const categorias = [
    { nombre: "Almacén", url: "https://diaonline.supermercadosdia.com.ar/almacen" },
    { nombre: "Bebidas", url: "https://diaonline.supermercadosdia.com.ar/bebidas" },
    { nombre: "Limpieza", url: "https://diaonline.supermercadosdia.com.ar/limpieza" },
    { nombre: "Perfumería", url: "https://diaonline.supermercadosdia.com.ar/perfumeria" },
    { nombre: "Frescos", url: "https://diaonline.supermercadosdia.com.ar/frescos" },
    { nombre: "Congelados", url: "https://diaonline.supermercadosdia.com.ar/congelados" },
  ];

  let todosLosProductos = [];

  for (const cat of categorias) {
    const productos = await scrapeVariosProductos(browser, page, cat.url, cat.nombre, 40);
    todosLosProductos = todosLosProductos.concat(productos);
    console.log(`✅ ${productos.length} productos obtenidos de ${cat.nombre}`);
    if (todosLosProductos.length >= 400) break;
  }

  if (todosLosProductos.length > 0) {
    if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync("data/productos.json", JSON.stringify(todosLosProductos, null, 2), "utf-8");
    console.log(`🟢 Se guardaron ${todosLosProductos.length} productos en data/productos.json`);
  } else {
    console.log("⚠️ No se obtuvieron productos.");
  }

  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
