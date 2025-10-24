import puppeteer from "puppeteer-core";
import fs from "fs";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scrapeVariosProductos(browser, page, urlCategoria, nombreCategoria, limite = 5) {
  await page.goto(urlCategoria, { waitUntil: "networkidle2", timeout: 60000 });
  const productSelector = ".diaio-search-result-0-x-galleryItem";
  await page.waitForSelector(productSelector, { timeout: 20000 });

  const productos = await page.evaluate((prodSelector, categoria, limite) => {
    const wrappers = Array.from(document.querySelectorAll(prodSelector)).slice(0, limite);
    return wrappers.map((wrapper) => {
      const nombre = wrapper.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText?.trim() ?? null;
      const marca = wrapper.querySelector(".vtex-store-components-3-x-productBrandName")?.innerText?.trim() ?? null;
      const precio =
        wrapper.querySelector(".diaio-store-5-x-sellingPriceValue")?.innerText?.trim() ??
        wrapper.querySelector(".vtex-product-price-1-x-sellingPriceValue")?.innerText?.trim() ?? null;
      const imagen = wrapper.querySelector("img")?.src ?? null;
      let url_producto = wrapper.querySelector("a")?.getAttribute("href") ?? null;
      if (url_producto) {
        try {
          url_producto = new URL(url_producto, location.origin).href;
        } catch {}
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
  }, productSelector, nombreCategoria, limite);

  for (const product of productos) {
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
      await sleep(400);
    } catch {}
  }

  return productos;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

  const categoria = { nombre: "Almacén", url: "https://diaonline.supermercadosdia.com.ar/almacen" };

  const productos = await scrapeVariosProductos(browser, page, categoria.url, categoria.nombre, 5);

  if (productos.length > 0) {
    if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync("data/productos.json", JSON.stringify(productos, null, 2), "utf-8");
  }

  await browser.close();
}

main().catch((err) => { process.exit(1); });
