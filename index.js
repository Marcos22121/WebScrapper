import puppeteer from "puppeteer-core";
import fs from "fs";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCategoria(page, urlCategoria, nombreCategoria) {
  console.log(`🔎 Scrapeando categoría: ${nombreCategoria} -> ${urlCategoria}`);
  await page.goto(urlCategoria, { waitUntil: "networkidle2", timeout: 60000 });

  const productSelector = ".diaio-search-result-0-x-galleryItem";
  let allProducts = [];
  let hasMore = true;
  let retriesNoNew = 0;
  const maxRetriesNoNew = 2;

  while (hasMore) {
    try {
      await page.waitForSelector(productSelector, { timeout: 20000 });
    } catch {
      console.log("⏹ No se encontraron productos en la página (timeout). Salimos.");
      break;
    }

    const beforeCount = await page.$$eval(productSelector, els => els.length);

    const pageProducts = await page.evaluate((prodSelector, categoria) => {
      const items = [];
      document.querySelectorAll(prodSelector).forEach(wrapper => {
        const nombre = wrapper.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText?.trim() ?? null;
        const marca = wrapper.querySelector(".vtex-store-components-3-x-productBrandName")?.innerText?.trim() ?? null;
        const descripcion = null;
        const precio = wrapper.querySelector(".diaio-store-5-x-sellingPriceValue")?.innerText?.trim()
                    ?? wrapper.querySelector(".vtex-product-price-1-x-sellingPriceValue")?.innerText?.trim()
                    ?? (wrapper.querySelector("[class*='price']")?.innerText?.trim() ?? null);
        const precio_regular = wrapper.querySelector(".diaio-store-5-x-listPriceValue")?.innerText?.trim() ?? null;
        const imagen = wrapper.querySelector("img")?.src ?? null;
        let url_producto = wrapper.querySelector("a")?.getAttribute("href") ?? null;
        if (url_producto) {
          try {
            url_producto = new URL(url_producto, location.origin).href;
          } catch {}
        }

        if (nombre || url_producto) {
          items.push({
            nombre, marca, categoria,
            descripcion,
            precio,
            precio_regular,
            precio_sin_impuestos: null,
            imagen,
            url_producto
          });
        }
      });
      return items;
    }, productSelector, nombreCategoria);

    pageProducts.forEach(p => {
      const exists = p.url_producto
        ? allProducts.some(ap => ap.url_producto === p.url_producto)
        : allProducts.some(ap => ap.nombre === p.nombre && ap.imagen === p.imagen);
      if (!exists) allProducts.push(p);
    });

    console.log(`📦 Productos recolectados: ${allProducts.length} (raw page count: ${beforeCount})`);

    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(b => {
          const t = (b.innerText || "").trim();
          const visible = b.offsetParent !== null && b.offsetWidth > 0 && b.offsetHeight > 0;
          return visible && t.includes("Mostrar más");
        });
      if (btn) {
        btn.scrollIntoView({ block: "center", behavior: "instant" });
        btn.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      console.log("✅ No hay más productos (botón 'Mostrar más' no encontrado o no visible).");
      break;
    }

    let loadedNew = false;
    const maxWaitMs = 15000;
    const pollInterval = 800;
    const timeoutAt = Date.now() + maxWaitMs;
    while (Date.now() < timeoutAt) {
      await sleep(pollInterval);
      const nowCount = await page.$$eval(productSelector, els => els.length);
      if (nowCount > beforeCount) {
        loadedNew = true;
        break;
      }
    }

    if (!loadedNew) {
      retriesNoNew++;
      console.log(`⚠️ No aparecieron productos nuevos después del click (intento ${retriesNoNew}/${maxRetriesNoNew}).`);
      if (retriesNoNew >= maxRetriesNoNew) {
        console.log("✅ Asumimos que no hay más productos. Terminando categoría.");
        break;
      } else {
        await sleep(1200);
      }
    } else {
      retriesNoNew = 0;
      await sleep(800);
    }
  }

  return allProducts;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage", "--no-sandbox"]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  const categorias = [
    { nombre: "Almacén", url: "https://diaonline.supermercadosdia.com.ar/almacen" },
    { nombre: "Bebidas", url: "https://diaonline.supermercadosdia.com.ar/bebidas" },
    { nombre: "Lácteos", url: "https://diaonline.supermercadosdia.com.ar/lacteos" }
  ];

  let productosTotales = [];

  for (const cat of categorias) {
    const productos = await scrapeCategoria(page, cat.url, cat.nombre);
    productosTotales = productosTotales.concat(productos);
  }

  if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/productos.json", JSON.stringify(productosTotales, null, 2), "utf-8");
  console.log(`\n✅ ${productosTotales.length} productos guardados en data/productos.json`);

  await browser.close();
  console.log("👋 Navegador cerrado correctamente.");
}

main().catch(err => {
  console.error("❌ Error general:", err);
  process.exit(1);
});
