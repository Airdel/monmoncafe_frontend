# Cambios de MonMon Café

Aquí queda lo que cambia en cada versión de la app (web y Android). Las versiones siguen [versionado semántico](https://semver.org/lang/es/):

- **patch** (2.0.**1**): arreglos, nada nuevo que aprender.
- **minor** (2.**1**.0): funciones nuevas.
- **major** (**3**.0.0): un cambio grande en cómo se usa la app.

Cada cambio se anota en **Sin publicar** en el mismo PR que lo hace. Al publicar una versión, esa sección pasa a ser la nueva versión y su texto es el de la release en GitHub, con el APK adjunto. Las APK de prueba del CI se llaman como la última versión publicada más el número de corrida (por ejemplo `2.0.0+70`).

## [Sin publicar]

### Agregado
- **Sonidos**: campanitas al registrar una venta, al mandar un pedido a comandas, cuando llega una comanda nueva o se marca lista, en errores y al guardar el corte. En Navidad la venta suena con cascabeles.
- En **Temas › Sonidos**: Apagados, Solo importantes (por defecto) o Todos (también al agregar y quitar productos), estilo **Cafetería** o **Burbujas** y volumen. Se guarda en cada dispositivo.
- **Eliminar receta** desde Recetas › Editar producto. Si ya se vendió, deja de aparecer en Recetas y en el POS, pero sus ventas, cortes y reportes se quedan igual. Necesita conexión con la PC.
- **Precio de compra** en Nuevo/Editar insumo: escribe cuánto pagaste por una cantidad (por ejemplo $420 por 1000 g) y el costo por unidad se actualiza al momento, sin registrar una compra. Las recetas usan ese costo; cada compra registrada lo vuelve a actualizar.

## [2.0.0] - 2026-10-21

Primera versión publicada. Reúne todo lo que la app ya hace hoy; a partir de aquí cada versión trae solo lo nuevo.

### Caja (punto de venta)
- Venta con categorías, fotos, búsqueda y modificadores (leche, extras, tamaños).
- Nombre y nota del pedido al cobrar, **Cobrar después** y pantalla de **Comandas** para preparar y cobrar pedidos.
- Descuentos por producto o por ticket, en pesos o porcentaje, con motivo.
- **Corregir** o **Anular** ventas (admin y supervisor); la venta anulada se conserva y puede devolver insumos.
- Venta con inventario en negativo, con aviso.
- **Escanear el código de barras** de un producto al marcar una compra en la lista de compras.

### Sin conexión con la PC
- La caja sigue vendiendo con la PC apagada: guarda menú, precios y fotos en el celular y envía ventas y comandas cuando la PC regresa.
- También se pueden registrar compras, gastos, roturas, conteos de inventario y herramientas, editar precios y recetas, armar la lista de compras y hacer un corte provisional sin la PC.
- Aviso en el corte cuando algún celular tiene registros sin enviar.

### Inventario y recetas
- Insumos: crear, editar, borrar, cambiar unidad, mínimos y máximos; búsqueda.
- Recetas: crear productos nuevos, editar nombre, precio, categoría, foto y si se ve en la caja; ilustraciones para los productos sin foto.
- Categorías de la caja: crear, editar, ordenar y borrar.
- **Tiendas** donde se compran los insumos.
- **Herramientas** (vasos, utensilios, equipo, limpieza) con cantidades ideales y reporte de roturas.
- **Lista de compras** con prioridades; al marcar "Compré…" se registra la compra y su costo; artículos extra.
- Productos **a consignación**: cuentan en inventario pero no en las finanzas.

### Finanzas
- Corte de caja del día con historial, gastos fijos y otros gastos del día.
- Reporte de **Ventas** con el consumo de insumos de cada venta.

### Apariencia
- Temas de color (Fresa con crema por defecto, Matcha latte, Lavanda, Café con leche y Noche) y diseño para celular, tablet y escritorio.
- **Material You**: efecto al tocar, vibración ligera, animaciones y el tema **Mi fondo**, que toma el color del fondo de pantalla de Android 12 o superior.
- **Decoración de temporada** (otoño, Día de Muertos, Navidad) automática por fecha o elegida a mano.
- Ícono, pantalla de inicio y favicon con el logo de MonMon Café; ventanas y avisos con el estilo de la app.

### Cuentas
- Inicio de sesión por roles (admin, supervisor, cajero) y pantalla de **Usuarios** para el admin.
- Versión de la app visible en el inicio de sesión y en Temas.

## Antes de 2.0.0 (APK de prueba 1.0.x)

Antes de las releases, cada APK del CI se llamaba `1.0.<número de corrida>`. Así se fueron sumando las funciones:

| Fecha | APK aprox. | Qué llegó |
|---|---|---|
| 2026-10-01 | — | Finanzas y corte de caja, app Android, temas, modificadores, Comandas, Cobrar después |
| 2026-10-02 | — | Reporte de Ventas, búsqueda en inventario, lista de recetas, lista de compras |
| 2026-10-03 | — | Versión web en GitHub Pages, Usuarios |
| 2026-10-04 | — | Tiendas, ventanas con estilo, editar productos con foto, compras desde la lista, insumos |
| 2026-10-07 | — | Categorías, ícono y logo |
| 2026-10-08 | — | APK firmado con llave fija (se instala encima), versión visible |
| 2026-10-09 | — | Crear recetas y editar precios, descuentos y correcciones de ventas, Herramientas |
| 2026-10-12 | — | Modo sin conexión para ventas y comandas |
| 2026-10-14 | 1.0.57–1.0.59 | Todo lo demás sin conexión (compras, gastos, conteos, recetas, corte) |
| 2026-10-17 | 1.0.63 | Consignación, decoración de temporada |
| 2026-10-21 | 1.0.65–1.0.67 | Código de barras, Material You |
