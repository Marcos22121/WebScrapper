Arranqué queriendo armar un scraper que recorra una categoría de un e commerce y guarde los productos en un archivo json al principio probé con un scroll infinito pero me traía solo diez productos y no era estable así que decidí armar algo que navegue entre páginas

Primero instalé puppeteer con npm init y npm i puppeteer y me apareció un warning de módulos que resolví agregando type module al package json también configuré puppeteer para que use mi chrome real en windows y puse headless false para ver lo que pasa en vivo

Después me enfoqué en la parte de recorrer las páginas armé una función navigatePages que espera que aparezcan los productos saca el nombre el precio la imagen y el link y después intenta pasar a la siguiente página primero probando con el botón de número y si no con la flecha agregué un setTimeout de unos segundos para que la página cargue antes de seguir y puse un try catch para que no se rompa si no encuentra el botón

Para los selectores usé el contenedor vtex product summary 2 x container y de ahí adentro saqué el nombre con vtex product summary 2 x productBrand el precio con vtex product price 1 x sellingPriceValue y como respaldo cualquier clase que tenga price también el src de la imagen y el href del link si un producto no tenía nombre o precio lo descartaba

Me encontré con que puppeteer ya no trae waitForTimeout así que lo cambié por un setTimeout dentro de una promesa también agregué un user agent real de chrome para evitar bloqueos y configuré goto con networkidle2 y timeout de 60 segundos para que espere bien

Al final en main abro el navegador seteo el user agent entro a la url de la categoría llamo a navigatePages y junto todos los productos si la carpeta data no existe la creo y después escribo productos json con los datos y cierro el navegador

Para correrlo instalo dependencias con npm i y lo ejecuto con node index js si quiero que sea más rápido y no abra ventanas cambio headless false por headless true


