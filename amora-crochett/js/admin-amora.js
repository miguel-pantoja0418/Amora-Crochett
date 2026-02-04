/* ========================================================= */
/* === 0️⃣ CONTROL DE INICIO Y SCROLL ====================== */
/* ========================================================= */
window.history.scrollRestoration = "manual"; // Instrucción para que NO recuerde la posición anterior
window.scrollTo(0, 0); // Salto inmediato al encabezado

/* ========================================================= */
/* === 1️⃣ CONFIGURACIÓN GENERAL Y FIREBASE ================ */
/* ========================================================= */
/* Propósito:
   - Punto de entrada único para la conexión con Google Firebase.
   - Inicializa los servicios core: Auth, Firestore y Storage.
   
   Reglas Críticas:
   - Uso de versión "compat" para mantener estabilidad con el código actual.
   - NO modificar las llaves de API ni el projectId para evitar pérdida de conexión.
   - La instancia 'db' es el contrato principal para todas las queries de Amora.
*/

const firebaseConfig = {
  apiKey: "AIzaSyDWi0iqaHYmbm3j8Kcv4jcy-LizkQpNq3M",
  authDomain: "paco-motos-gdl.firebaseapp.com",
  projectId: "paco-motos-gdl",
  storageBucket: "paco-motos-gdl.firebasestorage.app",
  messagingSenderId: "687238691058",
  appId: "1:687238691058:web:bd5597a27068fd6cf1386b",
};

// Inicialización blindada: previene errores de re-inicialización en hot-reload
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Instancias globales para el resto del sistema
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();

/* ========================================================= */
/* === 2️⃣ ESTADO GLOBAL DEL PANEL (ADMINSTATE) ============= */
/* ========================================================= */
/* Propósito:
   - Centraliza las variables de control que gestionan la UI.
   - Facilita el seguimiento de qué pieza se está editando o qué boletín se envía.
*/

/* ========================================================= */
/* === 3️⃣ VALIDACIÓN DE SESIÓN LOCAL (PRE-AUTH) =========== */
/* ========================================================= */
/* Propósito:
   - Optimiza la UX evitando parpadeos visuales al recargar la página.
   - Lee el estado persistente en el navegador antes de que Firebase responda.
*/

if (localStorage.getItem("amora_session") === "active") {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("admin-panel").classList.remove("hidden");
}

/* ========================================================= */
/* === 4️⃣ GESTIÓN DE SESIÓN Y AUTENTICACIÓN =============== */
/* ========================================================= */
/* Propósito:
   - Monitoriza el estado de la autenticación de Firebase.
   - Controla la visibilidad de las secciones del panel administrativo.
   - Inicializa la carga de datos y configuración al detectar un usuario válido.
*/

auth.onAuthStateChanged(async (user) => {
  const loginSection = document.getElementById("login-section");
  const adminPanel = document.getElementById("admin-panel");

  if (user) {
    // 1. Persistencia de sesión local para UX
    localStorage.setItem("amora_session", "active");

    // 2. Control de visibilidad: Prioridad de Servidor
    loginSection.classList.add("hidden");
    adminPanel.classList.remove("hidden");

    // 3. Inicialización de servicios en tiempo real
    cargarProductos();
    escucharResenas();
    escucharSuscriptores();

    // 4. Carga de Configuración Global (Promoción)
    try {
      const promoDoc = await db
        .collection("amora_config")
        .doc("global_promo")
        .get();

      if (promoDoc.exists) {
        const data = promoDoc.data();

        // Sincronización de campos de texto
        const promoInput = document.getElementById("promoText");
        if (promoInput) promoInput.value = data.texto || "";

        // Renderizado de miniatura de aviso
        if (data.imagenUrl) {
          const previewContainer = document.getElementById(
            "preview-promo-container",
          );
          if (previewContainer) {
            previewContainer.innerHTML = `
              <img src="${data.imagenUrl}" class="w-full h-32 object-cover rounded-xl shadow-sm border-2 border-pink-100">
            `;
          }
        }
      }
    } catch (err) {
      console.error("Error crítico al cargar configuración global:", err);
      showToast("Error al sincronizar aviso global", "#EF4444");
    }
  } else {
    // 5. Cierre de sesión y limpieza de estado
    localStorage.removeItem("amora_session");
    adminPanel.classList.add("hidden");
    loginSection.classList.remove("hidden");

    // Limpieza preventiva del formulario
    if (typeof limpiarForm === "function") limpiarForm();
  }
});

/* ========================================================= */
/* === 5️⃣ FUNCIONES DE ACCESO (LOGIN / LOGOUT) ============= */
/* ========================================================= */
/* Propósito:
   - Gestiona el ingreso y salida del personal administrativo.
   - Vincula las credenciales del DOM con Firebase Auth.
*/

// ================= AUTH =================

window.login = async () => {
  const email = document.getElementById("adminEmail").value.trim();
  const pass = document.getElementById("adminPass").value.trim();

  if (!email || !pass) {
    showToast("Completa correo y contraseña", "#F59E0B");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    showToast("Acceso concedido", "#22C55E");
  } catch (err) {
    showToast("Acceso denegado", "#EF4444");
  }
};

window.logout = () => {
  auth.signOut();
  localStorage.removeItem("amora_session");
  showToast("Sesión cerrada", "#64748B");
};

/* ========================================================= */
/* === 6️⃣ UTILIDADES (TOAST, HELPERS) ===================== */
/* ========================================================= */
/* Propósito:
   - Proveer feedback visual inmediato al usuario.
   - Centralizar funciones de apoyo estéticas y funcionales.
*/

function showToast(msj, color = "#5D4037") {
  const t = document.getElementById("toast");
  if (!t) return;

  t.innerText = msj;
  t.style.backgroundColor = color;
  t.style.display = "block";

  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.style.display = "none";
  }, 3500);
}

// ================= IMÁGENES =================
/**MOTOR DE COMPRESIÓN REAL: Convierte cualquier imagen a WebP
 * y reduce su peso antes de enviarla a Firebase Cloud Storage.*/
async function comprimirImagen(archivo) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(archivo);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1080; // Resolución optimizada para web
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // La magia: Convertimos a blob WebP con calidad 0.8
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/webp",
          0.8,
        );
      };
    };
  });
}

// Sube imágenes a Firebase Storage y regresa array de URLs
async function subirImagenes(fileList) {
  const urls = [];
  if (!fileList || fileList.length === 0) return urls;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    showToast(`Optimizando imagen ${i + 1}...`, "#D48498");

    // 1. Procesamos la imagen localmente
    const blobOptimizado = await comprimirImagen(file);

    // 2. Subimos el binario real optimizado
    const ref = storage.ref(`amora_productos/${Date.now()}_${i}.webp`);
    const uploadTask = await ref.put(blobOptimizado, {
      contentType: "image/webp",
    });
    const url = await uploadTask.ref.getDownloadURL();
    urls.push(url);
  }
  return urls;
}

// ================= FIRESTORE =================
// Alta o edición de producto según editId
async function guardarProductoFirestore(editId, data) {
  if (editId) {
    await db.collection("amora_productos").doc(editId).update(data);
    return "updated";
  } else {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection("amora_productos").add(data);
    return "created";
  }
}

// =============== FORM DATA ==================
function obtenerDataFormulario() {
  const precioBase = Number(document.getElementById("precio").value);
  const activarOferta = document.getElementById("activarOferta").checked;
  const precioFinal = activarOferta
    ? Number(document.getElementById("precio_final_db").value)
    : null;

  const data = {
    nombre: document.getElementById("nombre").value,
    medida: document.getElementById("medida").value,
    precio: precioBase,
    precio_final: precioFinal,
    descripcion: document.getElementById("descripcion").value,
    status: document.getElementById("status").value,
    categoria: document.getElementById("categoria").value,
    featured: document.getElementById("featured").checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // ESTRATEGIA DE VENTAS:
  // Si se está activando una oferta, actualizamos createdAt al tiempo actual.
  // Esto hace que el índice compuesto lo 'promocione' visualmente al inicio.
  if (activarOferta && precioFinal < precioBase) {
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  return data;
}

// =============== EDIT MODE ==================
/**
 * =========================================================
 * === CARGAR PRODUCTO EN FORMULARIO (MODO EDICIÓN) ========
 * =========================================================
 * Propósito:
 * - Reemplaza totalmente a prepararEdicion()
 * - Carga datos desde Firestore usando solo el ID
 * - Pone el formulario en modo edición real
 * - Mantiene coherencia con Ofertas, Imágenes y UX
 */
window.cargarProductoEnFormulario = async (id) => {
  try {
    // 1. Obtener documento desde Firestore
    const doc = await db.collection("amora_productos").doc(id).get();
    if (!doc.exists) return;

    const data = doc.data();

    // 2. ID de edición
    document.getElementById("edit-id").value = id;

    // 3. Campos básicos
    document.getElementById("nombre").value = data.nombre || "";
    document.getElementById("medida").value = data.medida || "";
    document.getElementById("precio").value = data.precio || "";
    document.getElementById("descripcion").value = data.descripcion || "";
    document.getElementById("status").value = data.status || "activo";
    document.getElementById("categoria").value = data.categoria || "";
    document.getElementById("featured").checked = !!data.featured;

    // 4. Módulo de Ofertas
    if (data.precio_final !== null && data.precio_final !== undefined) {
      document.getElementById("activarOferta").checked = true;
      document.getElementById("seccionOferta").classList.remove("hidden");
      document.getElementById("precio_final_db").value = data.precio_final;

      // Recalcular descuento como fijo
      document.getElementById("tipoDescuento").value = "fijo";
      document.getElementById("valorDescuento").value =
        data.precio - data.precio_final;

      actualizarPreviewOferta();
    } else {
      document.getElementById("activarOferta").checked = false;
      document.getElementById("seccionOferta").classList.add("hidden");
    }

    // 5. UX Modo Edición
    document.getElementById("btnGuardar").innerText = "ACTUALIZAR PIEZA";
    document.getElementById("form-title").innerText =
      "Editando: " + data.nombre;
    document.getElementById("btnCancelar").classList.remove("hidden");

    // 6. Carga de imágenes existentes
    const previewContainer = document.getElementById("preview-container");
    if (previewContainer) {
      previewContainer.innerHTML = "";
      const fotos = data.imagenes || (data.imagenUrl ? [data.imagenUrl] : []);
      fotos.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.className =
          "w-full h-20 object-cover rounded-xl border-2 border-[#E9E4D0] shadow-sm";
        previewContainer.appendChild(img);
      });
    }

    // 7. Scroll suave al formulario
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error("Error al cargar producto:", error);
    showToast("Error al cargar la pieza", "#EF4444");
  }
};

/* ========================================================= */
/* === 7️⃣ MÓDULO DE PRODUCTOS (CRUD) ======================= */
/* ========================================================= */
/* Propósito:
   - Gestión integral del catálogo de piezas (Lectura y Renderizado).
   - Implementa escucha en tiempo real de la colección 'amora_productos'.
   - Administra contadores de inventario y jerarquía visual.
*/

async function cargarProductos() {
  // Consulta optimizada para el índice compuesto: destacados primero, luego fecha
  db.collection("amora_productos")
    .orderBy("featured", "desc")
    .orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      const lista = document.getElementById("lista-articulos");
      if (!lista) return;
      lista.innerHTML = "";

      let total = snap.size;
      let disponibles = 0;
      let apartados = 0;
      let vendidos = 0;

      snap.forEach((doc) => {
        const p = doc.data();

        // 1. Conteo por estatus
        const estatusNormalizado = p.status?.toLowerCase();
        if (estatusNormalizado === "disponible") disponibles++;
        else if (estatusNormalizado === "apartado") apartados++;
        else if (estatusNormalizado === "vendido") vendidos++;

        const dot =
          p.status === "Disponible"
            ? "bg-green-500"
            : p.status === "Apartado"
              ? "bg-yellow-400"
              : "bg-red-500";

        let thumb =
          p.imagenes && p.imagenes.length > 0
            ? p.imagenes[0]
            : p.imagenUrl || "public/placeholder.png";

        // 2. Lógica de Oferta (Arquitectura Amora)
        const tieneOferta = p.precio_final && p.precio_final < p.precio;
        const ahorro = tieneOferta ? p.precio - p.precio_final : 0;
        const porcentaje = tieneOferta
          ? Math.round((ahorro / p.precio) * 100)
          : 0;

        const colorPromo = porcentaje >= 30 ? "bg-red-600" : "bg-[#D48498]";

        // 3. Estilo visual: Fondo crema sutil si tiene oferta, o estilo original Amora
        const estiloCard = tieneOferta
          ? "bg-[#FFFAF5] border-2 border-orange-100"
          : p.featured
            ? "border-2 border-[#D48498] bg-[#FDFBF9]"
            : "border border-gray-100 bg-white";

        // 4. Inyección de la tarjeta única con los nuevos ajustes de jerarquía visual
        lista.innerHTML += `
                <div class="${estiloCard} p-4 rounded-[25px] shadow-sm flex flex-col sm:flex-row items-center gap-4 mb-3 transition-all relative">
                    <div class="relative flex-shrink-0">
                        <img src="${thumb}" class="w-16 h-16 rounded-2xl object-cover shadow-sm flex-shrink-0">
                        ${
                          p.featured
                            ? '<span class="absolute -top-2 -left-2 bg-[#D48498] text-white text-[10px] p-1 rounded-full shadow-md">⭐</span>'
                            : ""
                        }
                    </div>

                    <div class="flex-1 w-full text-center sm:text-left">
                        <div class="flex items-center justify-between flex-wrap gap-2">
                            <h4 class="font-bold text-sm text-obs">
                                ${p.nombre} ${
                                  p.featured
                                    ? '<span class="text-[9px] uppercase tracking-tighter ml-1 font-black opacity-50">(Destacado)</span>'
                                    : ""
                                }
                            </h4>
                            
                            ${
                              tieneOferta
                                ? `
                                <span class="${colorPromo} text-white text-[9px] px-2 py-1 rounded-full font-black shadow-sm">
                                    -${porcentaje}% OFF
                                </span>
                                `
                                : ""
                            }
                        </div>

                        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 text-[11px] mt-1">
                            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full ${dot}"></span> ${p.status}</span>
                            <span class="text-gray-300">|</span>
                            <span class="text-gray-500 font-medium">${p.categoria || "Sin cat."}</span>
                            <span class="text-gray-300">|</span>
                            
                            ${
                              tieneOferta
                                ? `
                                <span class="text-gray-400 line-through">$${p.precio}</span>
                                <span class="text-red-600 font-black">$${p.precio_final} MXN</span>
                                `
                                : `
                                <span class="text-gray-700 font-bold">$${p.precio} MXN</span>
                                `
                            }
                        </div>
                    </div>

                    <div class="flex gap-2 w-full sm:w-auto justify-end">
                        <button onclick="cargarProductoEnFormulario('${doc.id}')" class="btn-editar px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tighter">Editar</button>
                        <button onclick="eliminarArticulo('${doc.id}')" class="btn-eliminar px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-tighter">Eliminar</button>
                    </div>
                </div>
        `;
      });

      // 5. Bloque de contadores (Intacto)
      const countContainer = document.getElementById("count-productos");
      if (countContainer) {
        countContainer.innerHTML = `
                <div class="flex flex-col gap-3 mt-4 w-full">
                    <div class="flex items-center justify-between border-b border-[#E9E4D0] pb-2">
                        <span class="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Total en Museo</span>
                        <span class="text-2xl font-extrabold text-[#5D4037]">${total}</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2">
                        <div class="bg-green-50 p-3 rounded-2xl text-center border border-green-100">
                            <p class="text-[9px] font-bold text-green-600 uppercase tracking-tighter mb-1">Disponibles</p>
                            <p class="text-lg font-black text-green-700">${disponibles}</p>
                        </div>
                        <div class="bg-yellow-50 p-3 rounded-2xl text-center border border-yellow-100">
                            <p class="text-[9px] font-bold text-yellow-600 uppercase tracking-tighter mb-1">Apartados</p>
                            <p class="text-lg font-black text-yellow-700">${apartados}</p>
                        </div>
                        <div class="bg-red-50 p-3 rounded-2xl text-center border border-red-100">
                            <p class="text-[9px] font-bold text-red-600 uppercase tracking-tighter mb-1">Vendidos</p>
                            <p class="text-lg font-black text-red-700">${vendidos}</p>
                        </div>
                    </div>
                </div>
            `;
      }
    });
}

/* ========================================================= */
/* === 8️⃣ GESTIÓN DE CARGA Y PERSISTENCIA (SUBMIT) ========= */
/* ========================================================= */
/* Propósito:
   - Controlar la lógica de subida de archivos a Storage.
   - Procesar el alta y edición de documentos en Firestore.
   - Manejar el estado visual del formulario durante el proceso.
*/

// Listener para visualización de cantidad de archivos seleccionados
document.getElementById("fotos").addEventListener("change", function () {
  const cant = this.files.length;
  document.getElementById("info-fotos").innerText =
    cant > 0
      ? `${cant} archivo(s) seleccionados para cargar`
      : "Ningún archivo seleccionado";
});

// Proceso principal de guardado/actualización
document.getElementById("amoraForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("btnGuardar");
  const editId = document.getElementById("edit-id").value;

  btn.disabled = true;
  btn.innerText = "Procesando...";

  try {
    const fileList = document.getElementById("fotos").files;
    // subirImagenes ya es secuencial, por lo que arrayUrls[0] será siempre el primer archivo seleccionado
    const arrayUrls = await subirImagenes(fileList);

    // Mapeo de datos del formulario
    const data = obtenerDataFormulario();

    if (arrayUrls.length > 0) {
      // Forzamos que la primera imagen subida sea la portada oficial
      data.imagenUrl = arrayUrls[0];
      data.imagenes = arrayUrls; // El array mantiene el orden [0, 1, 2...]
    }
    // Decisión: Crear o Actualizar
    const resultado = await guardarProductoFirestore(editId, data);
    if (resultado === "updated") {
      showToast("¡Pieza actualizada! ✨", "#10B981");
    } else {
      showToast("¡Pieza añadida! ✨", "#10B981");
    }

    limpiarForm();
  } catch (error) {
    console.error("Error detallado:", error);
    showToast("Error al procesar", "#EF4444");
  } finally {
    btn.disabled = false;
    btn.innerText = editId ? "ACTUALIZAR PIEZA" : "Añadir al Museo";
  }
});

/* ========================================================= */
/* === 9️⃣ MÓDULO DE PROMOCIÓN GLOBAL (AVISO) ============== */
/* ========================================================= */
/* Propósito:
   - Administrar el aviso destacado que aparece en la tienda.
   - Gestionar la carga de imagen y persistencia en amora_config.
*/

// Preview local de la imagen de promoción
window.previewPromo = (input) => {
  const container = document.getElementById("preview-promo-container");
  const infoText = document.getElementById("info-promo-file");
  container.innerHTML = "";

  if (input.files && input.files[0]) {
    // Actualizamos el texto informativo
    if (infoText) infoText.innerText = "¡Imagen lista para subir! ✨";

    const reader = new FileReader();
    reader.onload = (e) => {
      container.innerHTML = `
        <div class="relative">
          <img src="${e.target.result}" class="w-full h-40 object-cover rounded-xl border-2 border-[#D48498] shadow-sm">
          <span class="absolute top-2 right-2 bg-[#D48498] text-white text-[10px] px-2 py-1 rounded-lg font-bold">PREVISTA</span>
        </div>`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

// Guardado de la promoción global
document.getElementById("promoForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btnSavePromo");
  const promoText = document.getElementById("promoText").value;
  const file = document.getElementById("promoFile").files[0];

  btn.disabled = true;
  btn.innerText = "Actualizando...";

  try {
    let promoUrl = null;
    if (file) {
      const storageRef = storage.ref(`amora_config/aviso_destacado.webp`);
      const uploadTask = await storageRef.put(file);
      promoUrl = await uploadTask.ref.getDownloadURL();
    }

    const promoData = {
      texto: promoText,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (promoUrl) promoData.imagenUrl = promoUrl;

    await db
      .collection("amora_config")
      .doc("global_promo")
      .set(promoData, { merge: true });

    // Dentro del promoForm.addEventListener("submit"...)
    showToast("¡Aviso actualizado, Anita! 📢", "#D48498");

    if (file) {
      document.getElementById("preview-promo-container").innerHTML = "";
      document.getElementById("promoForm").reset();
      // Resetear el texto informativo
      const infoText = document.getElementById("info-promo-file");
      if (infoText)
        infoText.innerText = "Toca para cambiar la imagen del anuncio";
    }
  } catch (error) {
    console.error(error);
    showToast("Error al actualizar", "#EF4444");
  } finally {
    btn.disabled = false;
    btn.innerText = "Actualizar Aviso Global";
  }
});

/* ========================================================= */
/* === 🔟 GESTIÓN DE EDICIÓN Y LIMPIEZA =================== */
/* ========================================================= */
/* Propósito:
   - Cargar datos de piezas existentes en el formulario para su edición.
   - Manejar la lógica de visualización de ofertas y miniaturas en modo edición.
   - Restaurar el estado inicial del formulario mediante limpieza quirúrgica.
*/

function limpiarForm() {
  // 1. Resetear valores básicos del formulario
  document.getElementById("amoraForm").reset();
  document.getElementById("edit-id").value = "";
  document.getElementById("form-title").innerText = "Nueva Pieza";
  document.getElementById("btnGuardar").innerText = "Añadir al Museo";
  document.getElementById("btnCancelar").classList.add("hidden");

  // 2. Limpieza específica del Módulo de Ofertas
  document.getElementById("activarOferta").checked = false;
  document.getElementById("precio_final_db").value = "";
  document.getElementById("valorDescuento").value = "";

  if (typeof toggleSeccionOferta === "function") {
    toggleSeccionOferta();
  }

  // 3. Limpieza de información de archivos y fotografías
  const infoFotos = document.getElementById("info-fotos");
  if (infoFotos) {
    infoFotos.innerText = "Ningún archivo seleccionado";
  }

  const previewContainer = document.getElementById("preview-container");
  if (previewContainer) {
    previewContainer.innerHTML = "";
  }

  const miniPreview = document.getElementById("miniPreviewSVG");
  if (miniPreview) {
    miniPreview.innerHTML =
      '<span class="text-[8px] text-white text-center font-bold">ESPERANDO<br>DATOS</span>';
  }
}

document.getElementById("btnCancelar").onclick = limpiarForm;

/* ========================================================= */
/* === 1️⃣1️⃣ ELIMINACIÓN Y MODERACIÓN DE RESEÑAS ============ */
/* ========================================================= */
/* Propósito:
   - Gestionar el borrado físico de piezas y archivos en Storage.
   - Administrar el flujo de aprobación y moderación de reseñas.
*/

window.eliminarArticulo = async (id) => {
  if (!confirm("¿Anita: Segura que quieres eliminar esta pieza?")) return;

  showToast("Estamos eliminando la pieza...", "#D48498");

  try {
    const doc = await db.collection("amora_productos").doc(id).get();
    if (!doc.exists) return;
    const p = doc.data();

    const fotosAEliminar = p.imagenes || (p.imagenUrl ? [p.imagenUrl] : []);
    for (const url of fotosAEliminar) {
      try {
        await storage.refFromURL(url).delete();
      } catch (e) {
        console.warn("Archivo no encontrado:", url);
      }
    }

    await db.collection("amora_productos").doc(id).delete();
    showToast("¡Listo Carnala! Pieza eliminada correctamente ✅", "#D48498");
  } catch (err) {
    showToast("Error al eliminar", "#EF4444");
  }
};

function escucharResenas() {
  db.collection("amora_config")
    .doc("resenas_data")
    .onSnapshot((doc) => {
      const div = document.getElementById("lista-moderacion-resenas");
      if (!div) return;
      div.innerHTML = "";

      if (!doc.exists || !doc.data().muro || doc.data().muro.length === 0) {
        div.innerHTML =
          '<p class="text-xs italic text-gray-500">No hay reseñas registradas.</p>';
        return;
      }

      const resenas = doc.data().muro;
      const resenasOrdenadas = resenas
        .map((r, i) => ({ ...r, originalIndex: i }))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      resenasOrdenadas.forEach((r) => {
        const card = document.createElement("div");
        card.className = `p-4 rounded-2xl shadow-sm border flex flex-col gap-2 ${r.aprobado ? "bg-green-50 border-green-100" : "bg-orange-50 border-orange-100"}`;
        card.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-sm">${r.usuario}</span>
                    <span class="text-xs">${"⭐".repeat(r.estrellas)}</span>
                </div>
                <p class="italic text-xs text-gray-600">"${r.comentario}"</p>
                <div class="flex gap-2 mt-1 justify-end">
                    <button onclick="toggleAprobarResena(${r.originalIndex}, ${!r.aprobado})" class="btn-editar px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">${r.aprobado ? "Ocultar" : "Aprobar"}</button>
                    <button onclick="eliminarResenaReal(${r.originalIndex})" class="btn-eliminar px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tighter">Eliminar</button>
                </div>
            `;
        div.appendChild(card);
      });
    });
}

window.toggleAprobarResena = async (index, nuevoEstado) => {
  const docRef = db.collection("amora_config").doc("resenas_data");
  const doc = await docRef.get();
  let resenas = doc.data().muro;
  resenas[index].aprobado = nuevoEstado;
  await docRef.update({ muro: resenas });
  showToast(nuevoEstado ? "Reseña aprobada ✨" : "Reseña oculta 🤫");
};

window.eliminarResenaReal = async (index) => {
  if (!confirm("¿Segura Anita que quieres eliminar esta reseña?")) return;

  const docRef = db.collection("amora_config").doc("resenas_data");
  try {
    const doc = await docRef.get();
    let resenas = doc.data().muro;
    resenas.splice(index, 1);
    await docRef.update({ muro: resenas });
    showToast("Reseña eliminada correctamente hermana 🔕", "#D48498");
  } catch (err) {
    showToast("Error al eliminar", "#EF4444");
  }
};

/* ========================================================= */
/* === 1️⃣2️⃣ SUSCRIPTORES Y CONTADORES (EXTENDIDO) ========== */
/* ========================================================= */
/* Propósito:
   - Sincronizar en tiempo real la lista de suscriptores al boletín.
   - Calcular métricas de crecimiento (Total vs. Mes actual).
   - Renderizar el listado histórico con formato de fecha localizado.
*/

function escucharSuscriptores() {
  db.collection("amora_config")
    .doc("suscripciones")
    .onSnapshot((doc) => {
      const div = document.getElementById("lista-suscriptores");
      if (!div) return;
      div.innerHTML = "";

      let total = 0;
      let mesActual = 0;
      const ahora = new Date();
      const mes = ahora.getMonth();
      const anio = ahora.getFullYear();

      if (doc.exists && doc.data().boletines) {
        const lista = doc.data().boletines;
        total = lista.length;

        lista
          .slice()
          .reverse()
          .forEach((s) => {
            const fecha = new Date(s.fecha);
            if (fecha.getMonth() === mes && fecha.getFullYear() === anio) {
              mesActual++;
            }

            div.innerHTML += `
                    <div class="p-2 border-b border-gray-50 flex justify-between items-center text-sm">
                        <span class="font-medium text-[#5D4037]">${s.email}</span>
                        <span class="text-[12px] text-black-400 bg-gray-100 px-2 py-1 rounded-full">
                            ${fecha.toLocaleDateString()}
                        </span>
                    </div>`;
          });
      } else {
        div.innerHTML =
          '<p class="text-gray-400 text-sm italic">Sin suscriptores aún en la sección boletines.</p>';
      }

      const totalSpan = document.getElementById("total-suscriptores");
      const mesSpan = document.getElementById("suscriptores-mes");
      if (totalSpan) totalSpan.innerText = total;
      if (mesSpan) mesSpan.innerText = mesActual;

      // --- NUEVA VALIDACIÓN DE BOTÓN ---
      // Buscamos el botón de "Solo Nuevos" dentro del modal
      const btnMes = document.querySelector("button[onclick*='mes']");
      if (btnMes) {
        if (mesActual === 0) {
          btnMes.disabled = true;
          btnMes.classList.add("opacity-50", "cursor-not-allowed");
          btnMes.title = "No hay suscriptores nuevos este mes";
        } else {
          btnMes.disabled = false;
          btnMes.classList.remove("opacity-50", "cursor-not-allowed");
          btnMes.title = "";
        }
      }
    });
}

/* ========================================================= */
/* === SECCIÓN BOLETINES UNIFICADA (VERSIÓN FINAL) ========= */
/* ========================================================= */

// 1. Variables Globales (Aseguran que WORKER_URL esté disponible)
let tipoEnvioSeleccionado = "todos";
let productosBoletinSeleccionados = [];
const WORKER_URL = "https://amora-worker.pantoja0418.workers.dev/";

// 2. Funciones de Navegación de Modales
window.abrirModalTipoEnvio = function () {
  const modal = document.getElementById("modalTipoEnvio");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
};

window.cerrarModalTipoEnvio = function () {
  const modal = document.getElementById("modalTipoEnvio");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// Esta es la función que conecta los botones del Modal con el Editor
window.seleccionarEnvio = function (tipo) {
  tipoEnvioSeleccionado = tipo;
  window.cerrarModalTipoEnvio();

  // Abrimos el editor de contenido real (modalEditorBoletin)
  const modalEd = document.getElementById("modalEditorBoletin");
  if (modalEd) {
    modalEd.classList.remove("hidden");
    modalEd.classList.add("flex");
    if (typeof cargarProductosBoletin === "function") cargarProductosBoletin();
  }
};

window.cerrarEditorBoletin = function () {
  const modal = document.getElementById("modalEditorBoletin");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
};

// 3. Función de Envío Maestra (Respetando tu redacción y lógica)

// --- 1. Sincronización de Previsualización en Tiempo Real ---
// Este bloque hace que el texto aparezca en la "Pre" mientras escribes
const inputBoletin = document.getElementById("boletinTexto");
const previewDestino = document.getElementById("previewTextoBoletin");

if (inputBoletin && previewDestino) {
  inputBoletin.addEventListener("input", (e) => {
    previewDestino.innerText = e.target.value || "Aquí aparecerá tu mensaje…";
  });
}

// --- 2. Función de Envío Corregida ---
window.enviarBoletinFinal = async function () {
  const btn = document.getElementById("btnConfirmarEnvioBoletin");
  // CAMBIO CLAVE: Usamos 'boletinTexto' para que coincida con tu HTML
  const textoInput = document.getElementById("boletinTexto");
  const texto = textoInput ? textoInput.value.trim() : "";

  if (!texto) {
    showToast("⚠️ Escribe el mensaje del boletín", "#EF4444");
    return;
  }

  try {
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const doc = await db.collection("amora_config").doc("suscripciones").get();
    if (!doc.exists || !doc.data().boletines?.length) {
      showToast("No hay suscriptores registrados", "#EF4444");
      return;
    }

    const ahora = new Date();
    const correos = doc
      .data()
      .boletines.filter((s) => {
        if (tipoEnvioSeleccionado === "todos") return true;
        const f = new Date(s.fecha);
        return (
          f.getMonth() === ahora.getMonth() &&
          f.getFullYear() === ahora.getFullYear()
        );
      })
      .map((s) => s.email);

    if (correos.length === 0) {
      showToast("No hay correos para este segmento", "#EF4444");
      return;
    }

    let bloqueProductos = "";
    productosBoletinSeleccionados.forEach((p) => {
      bloqueProductos += `
        <div style="width: 100%; max-width: 500px; margin: 20px auto; text-align: center; border-bottom: 1px solid #eee; padding-bottom: 20px; font-family: 'Quicksand', sans-serif;">
            <div style="padding: 10px;">
                <img src="${p.imagen}" style="width: 100%; max-width: 280px; height: auto; border-radius: 20px; display: block; margin: 0 auto 15px auto; shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="margin: 0; color: #5D4037; font-size: 18px;">${p.nombre}</h3>
                <p style="font-size: 14px; color: #666; margin: 8px 0; line-height: 1.4;">${p.descripcion}</p>
                <div style="display: inline-block; background-color: #FDFBF9; padding: 5px 15px; border-radius: 10px; margin-top: 5px;">
                    <strong style="color: #D48498; font-size: 18px;">$${p.precio} MXN</strong>
                </div>
            </div>
        </div>`;
    });

    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contenido: texto.replace(/\n/g, "<br>") + bloqueProductos,
        correos: correos,
      }),
    });

    if (response.ok) {
      showToast("¡Boletín enviado con éxito! 💌", "#22C55E");
      window.cerrarEditorBoletin();

      if (textoInput) {
        textoInput.value = "";
        if (previewDestino)
          previewDestino.innerText = "Aquí aparecerá tu mensaje…";
      }

      // --- AJUSTE DE LIMPIEZA ---
      productosBoletinSeleccionados = []; // Vaciamos el array de productos
      const previewImagenes = document.getElementById("previewImagenesCorreo");
      if (previewImagenes) previewImagenes.innerHTML = ""; // Limpiamos la vista previa de fotos

      // Desmarcamos los checks para el siguiente envío
      document
        .querySelectorAll(".boletin-check")
        .forEach((chk) => (chk.checked = false));
    } else {
      showToast("Error en el servidor de correo", "#EF4444");
    }
  } catch (e) {
    console.error("Error de conexión:", e);
    showToast("Error de conexión", "#EF4444");
  } finally {
    btn.disabled = false;
    btn.innerText = "Enviar boletín";
  }
};

// 4. Vinculación Manual de Botones
const btnAbrir = document.getElementById("btnEnviarBoletin");
if (btnAbrir) btnAbrir.onclick = window.abrirModalTipoEnvio;

const btnFinal = document.getElementById("btnConfirmarEnvioBoletin");
if (btnFinal) btnFinal.onclick = window.enviarBoletinFinal;

/* ============================= */
/* === PRODUCTOS BOLETÍN ======= */
/* ============================= */

async function cargarProductosBoletin() {
  const contenedor = document.getElementById("productosBoletin");
  if (!contenedor) return;

  contenedor.innerHTML =
    '<p class="text-xs italic text-gray-400">Cargando piezas…</p>';

  const snap = await db
    .collection("amora_productos")
    .orderBy("updatedAt", "desc")
    .limit(6)
    .get();

  contenedor.innerHTML = "";

  snap.forEach((doc) => {
    const p = doc.data();
    const img =
      (p.imagenes && p.imagenes[0]) || p.imagenUrl || "public/placeholder.png";

    contenedor.innerHTML += `
            <label class="flex gap-3 items-center bg-white p-3 rounded-2xl border shadow-sm cursor-pointer">
                <input type="checkbox"
                       class="boletin-check"
                       data-nombre="${p.nombre}"
                       data-precio="${p.precio}"
                       data-descripcion="${p.descripcion}"
                       data-imagen="${img}">
                <img src="${img}" class="w-16 h-16 rounded-xl object-cover">
                <div class="flex-1">
                    <p class="font-bold text-sm">${p.nombre}</p>
                    <p class="text-xs text-gray-500">${p.categoria}</p>
                    <p class="text-xs font-bold text-[#5D4037]">$${p.precio} MXN</p>
                </div>
            </label>
        `;
  });

  activarSeleccionBoletin();
}

function activarSeleccionBoletin() {
  document.querySelectorAll(".boletin-check").forEach((chk) => {
    chk.addEventListener("change", () => {
      productosBoletinSeleccionados = [];

      document.querySelectorAll(".boletin-check:checked").forEach((c) => {
        productosBoletinSeleccionados.push({
          nombre: c.dataset.nombre,
          precio: c.dataset.precio,
          descripcion: c.dataset.descripcion,
          imagen: c.dataset.imagen,
        });
      });

      renderPreviewBoletin();
    });
  });
}

function renderPreviewBoletin() {
  const contenedor = document.getElementById("previewImagenesCorreo");
  contenedor.innerHTML = "";

  productosBoletinSeleccionados.forEach((p) => {
    contenedor.innerHTML += `
            <div class="border rounded-xl p-4 text-center">
                <img src="${p.imagen}" class="w-full max-w-[280px] mx-auto rounded-xl mb-3">
                <p class="font-bold text-sm">${p.nombre}</p>
                <p class="text-xs text-gray-600">${p.descripcion}</p>
                <p class="font-bold text-[#5D4037] mt-1">$${p.precio} MXN</p>
            </div>
        `;
  });
}

// Escuchar selección de archivos nuevos localmente
document.getElementById("fotos").addEventListener("change", function (e) {
  const previewContainer = document.getElementById("preview-container");
  const editId = document.getElementById("edit-id").value;

  // Si NO estamos editando, limpiamos todo para mostrar solo lo nuevo
  if (!editId) previewContainer.innerHTML = "";

  Array.from(e.target.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = document.createElement("img");
      img.src = evt.target.result;
      // Estilo: Borde punteado café para indicar que son fotos nuevas
      img.className =
        "w-full h-20 object-cover rounded-xl border-2 border-dashed border-[#8B735B] opacity-80";
      previewContainer.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

/* ============================================= */
/* === LÓGICA DE OFERTAS PARA AMORA CROCHET === */
/* ============================================= */

// 1. Control de visibilidad del panel
window.toggleSeccionOferta = () => {
  const seccion = document.getElementById("seccionOferta");
  const checkbox = document.getElementById("activarOferta");
  const inputHidden = document.getElementById("precio_final_db");

  if (!seccion || !checkbox) return;

  if (checkbox.checked) {
    seccion.classList.remove("hidden");
    actualizarPreviewOferta();
  } else {
    seccion.classList.add("hidden");
    if (inputHidden) inputHidden.value = "";
  }
};

// Motor de cálculo y Preview Dinámico
window.actualizarPreviewOferta = () => {
  const precioBase = parseFloat(document.getElementById("precio")?.value) || 0;
  const tipo = document.getElementById("tipoDescuento")?.value;
  const valor =
    parseFloat(document.getElementById("valorDescuento")?.value) || 0;

  const previewContainer = document.getElementById("miniPreviewSVG");
  const labelSugerido = document.getElementById("precioFinalSugerido");
  const inputHidden = document.getElementById("precio_final_db");
  const activarOferta = document.getElementById("activarOferta");

  if (!previewContainer || !labelSugerido || !inputHidden || !activarOferta)
    return;

  let precioFinal = precioBase;
  let porcentajeReal = 0;

  if (tipo === "porcentaje") {
    precioFinal = precioBase - precioBase * (valor / 100);
    porcentajeReal = valor;
  } else {
    precioFinal = precioBase - valor;
    porcentajeReal =
      precioBase > 0
        ? Math.round(((precioBase - precioFinal) / precioBase) * 100)
        : 0;
  }

  if (precioFinal < 0) precioFinal = 0;

  const precioFinalRedondeado = Math.round(precioFinal);
  labelSugerido.innerText = precioFinalRedondeado;
  inputHidden.value = precioFinalRedondeado;

  const colorOferta = porcentajeReal >= 30 ? "#FF3333" : "#D48498";

  if (precioBase > 0 && activarOferta.checked && valor > 0) {
    previewContainer.innerHTML = `
      <svg width="60" height="60" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="90" fill="black" stroke="white" stroke-width="6" />
        <text x="100" y="70" text-anchor="middle" font-size="12" fill="#777" font-weight="bold">
          Antes: $${precioBase}
        </text>
        <text x="100" y="115" text-anchor="middle" font-size="28" fill="${colorOferta}" font-weight="900">
          -${porcentajeReal}%
        </text>
        <text x="100" y="145" text-anchor="middle" font-size="12" fill="#4CAF50" font-weight="bold">
          OFERTA
        </text>
      </svg>
    `;
  } else {
    previewContainer.innerHTML =
      '<span class="text-[8px] text-white text-center font-bold">ESPERANDO<br>DATOS</span>';
  }
};
