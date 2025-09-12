import puppeteer from "puppeteer-core";
import fs from "fs";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeDia(page) {
  let allProducts = [];
  let hasMore = true;

  while (hasMore) {
    // Esperar productos cargados
    await page.waitForSelector(".vtex-product-summary-2-x-container", { timeout: 30000 });

    // Extraer productos de la página actual
    const pageProducts = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll(".vtex-product-summary-2-x-container").forEach(el => {
        const nombre = el.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText.trim() || "";
        const precio = el.querySelector(".diaio-store-5-x-sellingPriceValue")?.innerText.trim() || 
                      el.querySelector("[class*='price']")?.innerText.trim() || "";
        const imagen = el.querySelector("img")?.src || "";
        const url_producto = el.querySelector("a")?.href || "";

        if (nombre && precio) items.push({ nombre, precio, imagen, url_producto });
      });
      return items;
    });

    // Evitar duplicados por URL
    pageProducts.forEach(p => {
      if (!allProducts.some(ap => ap.url_producto === p.url_producto)) {
        allProducts.push(p);
      }
    });

    console.log(`Productos totales hasta ahora: ${allProducts.length}`);

    // Hacer scroll hasta abajo
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1000); // <-- delay con setTimeout

    // Intentar clicar "Mostrar más"
    const mostrarMasButton = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll("button")).find(
        btn => btn.innerText.includes("Mostrar más")
      );
    });

    if (mostrarMasButton) {
      try {
        await mostrarMasButton.click();
        await sleep(2000); // esperar que carguen más productos
      } catch (err) {
        console.log("Error al clicar 'Mostrar más':", err.message);
        hasMore = false;
      }
    } else {
      hasMore = false;
      console.log("No hay más productos para mostrar.");
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
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  const urlBase = "https://diaonline.supermercadosdia.com.ar/almacen"; // <-- poner URL de categoría
  await page.goto(urlBase, { waitUntil: "networkidle2", timeout: 60000 });

  const productos = await scrapeDia(page);

  if (!fs.existsSync("data")) fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/productos.json", JSON.stringify(productos, null, 2), "utf-8");
  console.log(`✅ ${productos.length} productos guardados en productos.json`);

  await browser.close();
}

main().catch(console.error);
