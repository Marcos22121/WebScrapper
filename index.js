import puppeteer from "puppeteer";
import fs from "fs";

async function navigatePages(page) {
  let allProducts = [];
  let currentPage = 1;
  let maxPages = 38;

  for (currentPage = 1; currentPage <= Math.min(maxPages, 38); currentPage++) {
    console.log(`Extrayendo productos de la página ${currentPage} de ${maxPages}`);
    
    await page.waitForSelector(".vtex-product-summary-2-x-container", { timeout: 10000 });
    
    const pageProducts = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll(".vtex-product-summary-2-x-container").forEach(el => {
        const nombre = el.querySelector(".vtex-product-summary-2-x-productBrand")?.innerText.trim() || "";
        const precio = el.querySelector(".vtex-product-price-1-x-sellingPriceValue")?.innerText.trim() || 
                      el.querySelector("[class*='price']")?.innerText.trim() || "";
        const imagen = el.querySelector("img")?.src || "";
        const url_producto = el.querySelector("a")?.href || "";
        
        if (nombre && precio) {
          items.push({ nombre, precio, imagen, url_producto });
        }
      });
      return items;
    });
    
    allProducts = allProducts.concat(pageProducts);
    console.log(`Encontrados ${pageProducts.length} productos en esta página. Total: ${allProducts.length}`);
    
    if (currentPage < Math.min(maxPages, 38)) {
      try {
        const nextPageSelector = `.discoargentina-search-result-custom-1-x-option-before[value="${currentPage + 1}"]`;
        const nextPageButton = await page.$(nextPageSelector);
        
        if (nextPageButton) {
          await nextPageButton.click();
        } else {
          console.log("Usando flecha para avanzar...");
          const arrowButton = await page.$('.discoargentina-search-result-custom-1-x-btn-next');
          if (arrowButton) {
            await arrowButton.click();
          } else {
            const arrowContainer = await page.$('.discoargentina-search-result-custom-1-x-content-btn-next');
            if (arrowContainer) {
              await arrowContainer.click();
            } else {
              throw new Error("No se encontró la flecha de navegación");
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.log(`No se pudo navegar a la página ${currentPage + 1}:`, error.message);
        break;
      }
    }
  }
  
  return allProducts;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  });

  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  await page.goto("https://www.vea.com.ar/electro?gad_campaignid=16106000066node", {
    waitUntil: "networkidle2",
    timeout: 60000
  });

  const productos = await navigatePages(page);

  if (!fs.existsSync("data")) {
    fs.mkdirSync("data", { recursive: true });
  }
  
  fs.writeFileSync("data/productos.json", JSON.stringify(productos, null, 2), "utf-8");
  console.log(`✅ ${productos.length} productos guardados en productos.json`);

  await browser.close();
}

main().catch(console.error);