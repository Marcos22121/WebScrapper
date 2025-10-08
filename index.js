import puppeteer from "puppeteer-core";
import fs from "fs";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCategoria(page, urlCategoria, nombreCategoria) {
  console.log(`🔎 Scrapeando categoría: ${nombreCategoria}`);
  await page.goto(urlCategoria, { waitUntil: "networkidle2", timeout: 60000 });

  let allProducts = [];
  let hasMore = true;

  while (hasMore) {
    try {
      await page.waitForSelector(".vtex-product-summary-2-x-container", { timeout: 15000 });
    } catch {
      console.log("⏹ No se encontraron más productos en la página.");
      break;
    }

    const pageProducts = await page.evaluate((categoria) => {
      const items = [];
      document.querySelectorAll(".vtex-product-summary-2-x-container").forEach(el => {
        const nombre = el.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText.trim() || null;
        const marca = el.querySelector(".vtex-product-summary-2-x-brandName")?.innerText.trim() || null;
        const descripcion = el.querySelector(".vtex-product-summary-2-x-productNameContainer")?.innerText.trim() || null;
        const precio = el.querySelector(".diaio-store-5-x-sellingPriceValue")?.innerText.trim() || null;
        const precio_regular = el.querySelector(".diaio-store-5-x-listPriceValue")?.innerText.trim() || null;
        const precio_sin_impuestos = null; // No aparece en el sitio, se deja null
        const imagen = el.querySelector("img")?.src || null;
        const url_producto = el.querySelector("a")?.href || null;

        if (nombre && precio) {
          items.push({
            nombre,
            marca,
            categoria,
            descripcion,
            precio,
            precio_regular,
            precio_sin_impuestos,
            imagen,
            url_producto
          });
        }
      });
      return items;
    }, nombreCategoria);

    // Evitar duplicados
    pageProducts.forEach(p => {
      if (!allProducts.some(ap => ap.url_producto === p.url_producto)) {
        allProducts.push(p);
      }
    });

    console.log(`📦 Productos recolectados: ${allProducts.length}`);

    const mostrarMasExiste = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(b => b.innerText.includes("Mostrar más"));
      if (btn) {
        btn.scrollIntoView();
        btn.click();
        return true;
      }
      return false;
    });

    if (mostrarMasExiste) {
      await sleep(2500);
    } else {
      console.log("✅ No hay más productos en esta categoría.");
      hasMore = false;
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
