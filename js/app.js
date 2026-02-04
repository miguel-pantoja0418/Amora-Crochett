/* =====================================
   SECCIÓN 1 – CONFIGURACIÓN Y ESTADO
   Responsabilidad: Control centralizado
   ===================================== */

// 1.1 Configuración de Firebase (Aislamiento de Entorno)
const firebaseConfig = {
  apiKey: "AIzaSyDWi0iqaHYmbm3j8Kcv4jcy-LizkQpNq3M", //
  authDomain: "paco-motos-gdl.firebaseapp.com", //
  projectId: "paco-motos-gdl", //
  storageBucket: "paco-motos-gdl.firebasestorage.app", //
  messagingSenderId: "687238691058", //
  appId: "1:687238691058:web:bd5597a27068fd6cf1386b", //
};

// 1.2 Inicialización de Instancia
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig); //
}
const db = firebase.firestore(); //

// 1.3 FrontState: Objeto de Estado Maestro (Mantenibilidad)
// Sustituye las variables sueltas por un único punto de control
const FrontState = {
  tienda: {
    categoriaActual: "Todos", //
    scrollPosition: 0,
  },
  museo: {
    categoriaActual: "Todos", //
    scrollPosition: 0,
  },
  ui: {
    activeTab: "index",
    modalesAbiertos: [],
  },
};

/* =====================================
   SECCIÓN 2 – CAPA DE DATOS (AmoraPublicDB)
   Responsabilidad: Abstracción de Firestore
   ===================================== */
const AmoraPublicDB = {
  // Referencias optimizadas para evitar duplicidad de strings
  col: {
    productos: "amora_productos",
    config: "amora_config",
  },
};

/* =====================================
   SECCIÓN 3 – MOTOR DE NAVEGACIÓN
   Responsabilidad: Gestión de Vistas (Tabs)
   ===================================== */

window.changeTab = function (tab) {
  // 3.1 Referencias a Contenedores de Vista
  const views = {
    index: document.getElementById("view-index"),
    tienda: document.getElementById("view-tienda"),
    destacados: document.getElementById("view-destacados"),
    museo: document.getElementById("view-museo"),
  };

  const navItems = document.querySelectorAll(".nav-item");

  // 3.2 Reset de Estado Visual (Ocultar Todo)
  Object.values(views).forEach((view) => {
    if (view) view.style.display = "none";
  });

  navItems.forEach((n) => n.classList.remove("active"));

  // 3.3 Activación de Vista Solicitada
  if (views[tab]) {
    views[tab].style.display = "block";

    // Actualización del FrontState (Nuevo Control)
    FrontState.ui.activeTab = tab;

    // Gestión de Clases en Nav
    const activeNav = document.getElementById(`nav-${tab}`);
    if (activeNav) activeNav.classList.add("active");

    // Desencadenar Carga de Datos según Sección
    switch (tab) {
      case "tienda":
        cargarTienda();
        break;
      case "destacados":
        cargarDestacados();
        break;
      case "museo":
        cargarMuseo();
        escucharResenasPublicas();
        break;
    }
  }

  // 3.4 Reset de Scroll al inicio
  window.scrollTo(0, 0);
};

/* =====================================
   SECCIÓN 4 – GESTIÓN DE FILTROS
   Responsabilidad: Control de categorías
   ===================================== */

// 4.1 Lógica Unificada de Estilos para Filtros
const UI_FILTERS = {
  clasesActivo: [
    "bg-[#5D4037]",
    "text-white",
    "border-[#5D4037]",
    "shadow-md",
    "active",
  ],
  clasesInactivo: ["bg-white", "text-gray-500", "border-gray-100"],
};

// 4.2 Filtrado de Tienda
window.filtrarTienda = function (cat) {
  FrontState.tienda.categoriaActual = cat;

  document.querySelectorAll("#view-tienda .filter-btn").forEach((b) => {
    // Reset de estados previos
    b.classList.remove(...UI_FILTERS.clasesActivo);
    b.classList.add(...UI_FILTERS.clasesInactivo);

    // Extracción segura de categoría del atributo onclick
    const categoriaBoton = b.getAttribute("onclick").match(/'([^']+)'/)[1];

    if (categoriaBoton === cat) {
      b.classList.add(...UI_FILTERS.clasesActivo);
      b.classList.remove(...UI_FILTERS.clasesInactivo);
    }
  });

  cargarTienda();
};

// 4.3 Filtrado de Museo
window.filtrarMuseo = function (cat) {
  FrontState.museo.categoriaActual = cat;

  document.querySelectorAll("#view-museo .filter-btn").forEach((b) => {
    b.classList.remove(...UI_FILTERS.clasesActivo);
    b.classList.add(...UI_FILTERS.clasesInactivo);

    const categoriaBoton = b.getAttribute("onclick").match(/'([^']+)'/)[1];

    if (categoriaBoton === cat) {
      b.classList.add(...UI_FILTERS.clasesActivo);
      b.classList.remove(...UI_FILTERS.clasesInactivo);
    }
  });

  cargarMuseo();
};

/**
 * ======================================
 * SECCIÓN 5 – PROCESAMIENTO DE DATOS
 * Responsabilidad: Preparar objetos puros
 * ====================================== */
//5.1 – FILTRADO DE NEGOCIO
function procesarProductos(snapshot, categoriaActual, filtroStatus = null) {
  const productos = [];
  snapshot.forEach((doc) => {
    const p = doc.data();
    p.id = doc.id;

    // Regla de exclusión: Tienda vs Museo
    if (
      filtroStatus === "Tienda" &&
      (p.status === "Vendido" || p.featured === true)
    )
      return;
    if (filtroStatus === "Museo" && p.status !== "Vendido") return;

    // Filtro de categoría
    if (categoriaActual !== "Todos" && p.categoria !== categoriaActual) return;

    productos.push(p);
  });
  return productos;
}

/**
 * =====================================
 * SECCIÓN 6 – RENDERIZADO DE UI
 * Responsabilidad: Construcción de HTML
 * ===================================== */

// 6.1 Constructor de COMPONENTES / Tarjetas
function buildProductoHTML(p) {
  const colorStatus = p.status === "Disponible" ? "#C05C5C" : "#D48498";
  const bgRibbon = p.status === "Vendido" ? "#A0A0A0" : colorStatus;
  const imgPrincipal =
    p.imagenes && p.imagenes.length > 0
      ? p.imagenes[0]
      : Array.isArray(p.imagenUrl)
        ? p.imagenUrl[0]
        : p.imagenUrl;
  const badgeOferta = generarHTMLOferta(p);
  //HELPER DE OFERTA
  return `
    <div class="item-card animate-item relative overflow-hidden">
        <div class="ribbon" style="background-color: ${bgRibbon}">${p.status}</div>
        ${badgeOferta} 
        <div class="card-info">
            <div class="info-top"><h3 class="nombre-pieza">${p.nombre}</h3></div>
            <div class="info-bottom">
                <button onclick="verDetalle('${p.id}', ${p.status === "Vendido"})" class="ver-mas-btn">
                    ${p.status === "Vendido" ? "VER HISTORIA" : "Ver más detalles"}
                </button>
                <div class="precio-tag">
                    ${p.status === "Vendido" ? "Colección Privada" : "MXN $" + (p.precio_final || p.precio)}
                </div>
            </div>
        </div>
        <div class="card-image-side">
          <img src="${imgPrincipal}" 
              class="w-full h-full object-cover" 
              alt="Amigurumi artesanal ${p.nombre} por Amora Crochett">
        </div>
    </div>`;
}

// 6.2 MOTOR DE INYECCIÓN (GRID)
function cargarTienda() {
  db.collection(AmoraPublicDB.col.productos)
    .orderBy("featured", "desc")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const grid = document.getElementById("grid-productos");
      if (!grid) return;
      const datos = procesarProductos(
        snapshot,
        FrontState.tienda.categoriaActual,
        "Tienda",
      );
      grid.innerHTML = datos.map((p) => buildProductoHTML(p)).join("");
    });
}

function cargarMuseo() {
  db.collection(AmoraPublicDB.col.productos)
    .where("status", "==", "Vendido")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const grid = document.getElementById("grid-museo");
      if (!grid) return;
      const datos = procesarProductos(
        snapshot,
        FrontState.museo.categoriaActual,
        "Museo",
      );
      grid.innerHTML = datos.map((p) => buildProductoHTML(p)).join("");
    });
}

// 6.3 Helper: Generador de Badge de Oferta
function generarHTMLOferta(p) {
  if (!p.precio_final || p.precio_final >= p.precio) return "";
  const ahorro = Math.round(((p.precio - p.precio_final) / p.precio) * 100);
  const colorAhorro = ahorro >= 30 ? "#FF3333" : "#D48498";

  return `
    <div class="absolute top-1 right-1 z-50 animate-oferta" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3))">
        <svg width="62" height="62" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="black" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="white" stroke-width="2" stroke-dasharray="4,4" opacity="0.5" />
            <text x="50" y="35" text-anchor="middle" fill="#A0A0A0" font-size="8" font-weight="bold" font-family="Quicksand">Antes: $${p.precio}</text>
            <text x="50" y="60" text-anchor="middle" fill="${colorAhorro}" font-size="22" font-weight="900" font-family="Quicksand">-${ahorro}%</text>
            <text x="50" y="80" text-anchor="middle" fill="white" font-size="10" font-weight="bold" letter-spacing="1" font-family="Quicksand">OFERTA</text>
        </svg>
    </div>`;
}

/**
 * =======================================
 * SECCIÓN 6.4 – GESTIÓN DE DESTACADOS
 * Responsabilidad: Productos notables y promos
 * =======================================*/

// 6.4.1 Cargador de Destacados (Lógica de Orquestación)
async function cargarDestacados() {
  try {
    const contenedor = document.getElementById(
      "contenedor-destacados-dinamico",
    );
    if (!contenedor) return;
    contenedor.innerHTML = "";

    // A. Banner Promocional Global
    const docPromo = await db
      .collection(AmoraPublicDB.col.config)
      .doc("global_promo")
      .get();
    if (docPromo.exists) {
      const data = docPromo.data();
      contenedor.innerHTML += buildDestacadoHTML(
        data.imagenUrl,
        data.texto || "Pieza Destacada",
      );
    }

    // B. Productos Marcados como Featured
    const snapFeatured = await db
      .collection(AmoraPublicDB.col.productos)
      .where("featured", "==", true)
      .get();

    snapFeatured.forEach((doc) => {
      const p = doc.data();
      p.id = doc.id;

      const imgPrincipal =
        p.imagenes && p.imagenes.length > 0
          ? p.imagenes[0]
          : Array.isArray(p.imagenUrl)
            ? p.imagenUrl[0]
            : p.imagenUrl;

      const precioAMostrar = p.precio_final || p.precio;
      const textoEnriquecido = `${p.nombre} | MXN $${precioAMostrar} | ${p.categoria || "Amigurumi"}`;

      contenedor.innerHTML += buildDestacadoHTML(
        imgPrincipal,
        textoEnriquecido,
        p,
      );
    });
  } catch (error) {
    console.error("Error en destacados:", error);
  }
}

// 6.4.2 Constructor Visual de Destacados (Integridad Visual)
function buildDestacadoHTML(img, texto, producto = null) {
  let botonHTML = "";
  let htmlOferta = "";

  // Si es un producto real, añadimos botón y badge de oferta
  if (producto && producto.id) {
    botonHTML = `<button onclick="verDetalle('${producto.id}')" class="btn-perfil-action mt-4 cursor-pointer">ME INTERESA</button>`;
    htmlOferta = generarHTMLOferta(producto);
  }

  // Estructura idéntica para preservar diseño CSS
  return `
    <div class="flex flex-col items-center w-full relative">
        <div class="card-destacado-layer relative">
            ${htmlOferta}
            <div class="flex justify-center items-center w-full h-full">
                <img src="${img}" class="img-fondo-promo" alt="Destacado">
            </div>
            <img src="public/marco.png" class="img-marco-promo" alt="Marco">
        </div>
        <div class="promo-texto-frame">
            <p class="text-white text-[14px] font-bold italic text-center leading-tight px-2">${texto}</p>
        </div>
        ${botonHTML}
        <div class="separador-amora w-full">
              <span class="separador-emoji">🧶</span>
        </div>
    </div>`;
}

/**
 * ========================================
 * SECCIÓN 7 – DETALLES Y GALERÍA
 * Responsabilidad: Renderizado de detalles
 * ========================================*/

window.verDetalle = async function (id, esMuseo = false) {
  const doc = await db.collection(AmoraPublicDB.col.productos).doc(id).get();
  if (!doc.exists) return;

  const p = doc.data();
  const modalBtn = document.getElementById("btnAdquirir");
  const galeria = document.getElementById("galeriaContenedor");
  const precioOriginalEl = document.getElementById("detPrecioOriginal");
  const precioPrincipalEl = document.getElementById("detPrecio");

  // Datos básicos
  document.getElementById("detNombre").innerText = p.nombre;
  document.getElementById("detCategoria").innerText =
    p.categoria || "Amigurumi";
  document.getElementById("detDescripcion").innerText =
    p.descripcion || "Sin descripción.";
  document.getElementById("detMedida").innerText = p.medida || "Estándar";

  // Galería
  // Galería: Limpieza de imágenes y de puntos previos para evitar duplicados
  galeria.innerHTML = "";
  const existingDots = document.querySelector(".gallery-dots");
  if (existingDots) existingDots.remove(); // Elimina los puntos del producto anterior

  const dotContainer = document.createElement("div");
  dotContainer.className = "gallery-dots";

  const imagenes = Array.isArray(p.imagenes)
    ? p.imagenes
    : Array.isArray(p.imagenUrl)
      ? p.imagenUrl
      : [p.imagenUrl];

  imagenes.forEach((url, index) => {
    if (!url) return;

    // Crear Imagen
    const imgElement = document.createElement("img");
    imgElement.src = url;
    imgElement.className =
      "flex-none w-full h-72 object-contain bg-white rounded-3xl snap-center cursor-zoom-in border border-[#F5F1E6]";
    imgElement.onclick = () => window.expandImage(url);
    galeria.appendChild(imgElement);

    // Crear Punto (Dot)
    const dot = document.createElement("div");
    dot.className = `dot ${index === 0 ? "active" : ""}`;
    dotContainer.appendChild(dot);
  });

  // Insertar puntos después de la galería
  galeria.parentNode.insertBefore(dotContainer, galeria.nextSibling);

  // Lógica de scroll para los puntos
  galeria.onscroll = () => {
    const index = Math.round(galeria.scrollLeft / galeria.offsetWidth);
    const dots = dotContainer.querySelectorAll(".dot");
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  };

  // Lógica de Precios y Botón
  if (esMuseo) {
    precioOriginalEl.classList.add("hidden");
    precioPrincipalEl.innerText = "Pieza de Colección Privada";
    modalBtn.innerText = "SOLICITAR PIEZA SIMILAR";
    modalBtn.href = "javascript:void(0)";
    modalBtn.onclick = () => {
      closeModal("modalDetalles");
      openModal("modalPedidos");
    };
  } else {
    if (p.precio_final && p.precio_final < p.precio) {
      precioOriginalEl.innerText = `Antes: MXN $${p.precio}`;
      precioOriginalEl.classList.remove("hidden");
      precioPrincipalEl.innerText = `AHORA: MXN $${p.precio_final}`;
      precioPrincipalEl.style.color = "#FF3333";
    } else {
      precioOriginalEl.classList.add("hidden");
      precioPrincipalEl.innerText = `MXN $${p.precio}`;
      precioPrincipalEl.style.color = "#5D4037";
    }
    const msj = encodeURIComponent(
      `Hola, vi esta pieza en su catálogo: ${p.nombre}. Me gustaría adquirirla.`,
    );
    modalBtn.innerText = "ADQUIRIR PIEZA";
    modalBtn.target = "_blank";
    modalBtn.href = `https://wa.me/523313575180?text=${msj}`;
    modalBtn.onclick = null;
  }
  window.openModal("modalDetalles");
  // --- CAPA DE INTELIGENCIA AEO (JSON-LD) ---
  const elSchema =
    document.getElementById("schema-producto") ||
    document.createElement("script");
  elSchema.id = "schema-producto";
  elSchema.type = "application/ld+json";
  elSchema.text = JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: p.nombre,
    image: imagenes,
    description: p.descripcion,
    brand: { "@type": "Brand", name: "Amora Crochett" },
    offers: {
      "@type": "Offer",
      priceCurrency: "MXN",
      price: p.precio_final || p.precio,
      availability:
        p.status === "Disponible"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  });
  if (!document.getElementById("schema-producto"))
    document.head.appendChild(elSchema);
};

/**
 * =======================================
 * SECCIÓN 7.1 – VOCES DE AMORA (RESEÑAS)
 * Responsabilidad: Renderizado del muro
 * =======================================*/

// 6.6.1 Envío de Reseñas (Lógica de Escritura)
const resForm = document.getElementById("resenaForm");
if (resForm) {
  resForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnEnviarResena");
    const usuario = document.getElementById("resNombre").value;
    const estrellas = parseInt(document.getElementById("resEstrellas").value);
    const comentario = document.getElementById("resComentario").value;

    btn.innerText = "ENVIANDO...";
    btn.disabled = true;

    try {
      const resenaRef = db
        .collection(AmoraPublicDB.col.config)
        .doc("resenas_data");
      const nuevaResena = {
        usuario,
        estrellas,
        comentario,
        aprobado: false, // Requiere moderación manual
        fecha: new Date().toISOString(),
      };

      await resenaRef.set(
        {
          muro: firebase.firestore.FieldValue.arrayUnion(nuevaResena),
        },
        { merge: true },
      );

      showToast(
        "¡Gracias! Tu reseña aparecerá tras ser validada ✨",
        "#5D4037",
      );
      resForm.reset();
    } catch (error) {
      showToast("No se pudo enviar la reseña ❌", "#C0392B");
    } finally {
      btn.innerText = "Enviar Comentario";
      btn.disabled = false;
    }
  });
}

// 7.2 Escucha y Renderizado del Muro [
function escucharResenasPublicas() {
  db.collection(AmoraPublicDB.col.config)
    .doc("resenas_data")
    .onSnapshot((doc) => {
      const contenedor = document.getElementById("lista-resenas-publicas");
      if (!contenedor || !doc.exists || !doc.data().muro) return;

      const aprobadas = doc
        .data()
        .muro.filter((r) => r.aprobado)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      if (aprobadas.length === 0) {
        contenedor.innerHTML =
          '<p class="text-xs italic text-gray-400 text-center py-4">Aún no hay mensajes en el muro.</p>';
        return;
      }

      contenedor.innerHTML = aprobadas
        .map(
          (r) => `
        <div class="bg-green-50 p-5 rounded-3xl border border-green-100 shadow-sm relative mb-4 animate-item">
            <div class="flex justify-between items-start mb-2">
                <span class="font-bold text-[#5D4037] text-xs uppercase tracking-tighter">${r.usuario}</span> 
                <div class="text-[10px]">${"⭐".repeat(r.estrellas)}</div> 
            </div>
            <p class="text-[#5D4037] text-[12px] leading-relaxed italic relative z-10 font-medium">"${r.comentario}"</p>
        </div>`,
        )
        .join("");
    });
}

/**
 * =======================================
 * SECCIÓN 8 – BOLETÍN / SUSCRIPCIONES
 * Responsabilidad: Captación de leads
 * =======================================*/

const formSuscripcion = document.getElementById("subscribeForm");
if (formSuscripcion) {
  formSuscripcion.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById("subEmail");
    const emailValue = emailInput?.value.trim().toLowerCase();

    if (!emailValue) return;

    const docRef = db.collection(AmoraPublicDB.col.config).doc("suscripciones");

    try {
      const doc = await docRef.get();
      // Validación estricta de duplicados
      if (
        doc.exists &&
        (doc.data().boletines || []).some((i) => i.email === emailValue)
      ) {
        showToast("Este correo ya está suscrito. 📧", "#D4A373");
        return;
      }

      await docRef.set(
        {
          boletines: firebase.firestore.FieldValue.arrayUnion({
            email: emailValue,
            fecha: new Date().toISOString(),
          }),
        },
        { merge: true },
      );

      showToast("¡Te has suscrito con éxito! ✨", "#5D4037");
      formSuscripcion.reset();
    } catch (error) {
      showToast("Error al procesar suscripción. ❌", "#C0392B");
    }
  });
}

/* =====================================
   SECCIÓN 9 – UTILIDADES Y ARRANQUE
   Responsabilidad: Helpers y ciclos base
   ===================================== */

function showToast(msj, color = "#5D4037") {
  const container = document.getElementById("toast");
  const textSpan = document.getElementById("toast-text");
  if (!container || !textSpan) return;

  // Inyectamos un emoji brillante antes del mensaje
  textSpan.innerHTML = `<span style="margin-right:8px">✨</span>${msj}`;
  container.style.backgroundColor = color;
  container.classList.add("show");

  // Feedback háptico visual (pequeño salto)
  container.style.transform = "translateX(-50%) translateY(-10px)";
  setTimeout(() => {
    container.style.transform = "translateX(-50%) translateY(0)";
  }, 150);

  setTimeout(() => container.classList.remove("show"), 3500);
}

function mostrarFechaActual() {
  const elementosFecha = document.querySelectorAll(".fecha-actual");
  const fecha = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  elementosFecha.forEach((el) => (el.innerText = `📅 ${fecha}`));
}

// 9.1 Inicialización Global
document.addEventListener("DOMContentLoaded", () => {
  mostrarFechaActual();
  setTimeout(() => {
    filtrarTienda("Todos");
    filtrarMuseo("Todos");
  }, 100);
});

/**
 * =====================================
 * SECCIÓN 9.2 – HELPERS DE MODALES
 * Responsabilidad: Control de visibilidad
 * =====================================
 */

window.openModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.style.display = "block";
    document.body.style.overflow = "hidden";
    FrontState.ui.modalesAbiertos.push(id); // Control en FrontState
  }
};

window.closeModal = (id) => {
  const m = document.getElementById(id);
  if (m) {
    m.style.display = "none";
    FrontState.ui.modalesAbiertos = FrontState.ui.modalesAbiertos.filter(
      (mid) => mid !== id,
    );
    if (FrontState.ui.modalesAbiertos.length === 0) {
      document.body.style.overflow = "auto"; // Libera scroll
    }
  }
};

window.expandImage = (src) => {
  document.getElementById("imgExpandida").src = src;
  window.openModal("modalImagen");
};

/**
 * =====================================
 * SECCIÓN 10 – EVENTOS DOM
 * Responsabilidad: Delegación y Listeners
 * ===================================== */

document.addEventListener("DOMContentLoaded", () => {
  // 10.1 Delegación de Eventos para botones dinámicos
  document.body.addEventListener("click", (e) => {
    const target = e.target;

    if (target.dataset.action === "ver-detalle") {
      const id = target.dataset.id;
      const esMuseo = FrontState.ui.activeTab === "museo";
      verDetalle(id, esMuseo);
    }
  });

  // Inicialización base
  mostrarFechaActual();
  setTimeout(() => {
    filtrarTienda("Todos");
    filtrarMuseo("Todos");
  }, 100);
});
