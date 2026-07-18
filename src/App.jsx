import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, ShoppingCart, Search, Star, Phone, MessageCircle, Plus, Minus, X,
  ChevronLeft, ChevronRight, Check, Package, Clock, MapPin, Settings,
  Camera, Sparkles, Trash2, Pencil, Tag, Award, Home, User, RefreshCw,
  ChevronDown, LogOut, ImagePlus, Flame, Eye, EyeOff
} from "lucide-react";
import { getDocData, setDocData, deleteDocData, listDocs } from "./lib/db.js";

/* ---------------------------------- constants ---------------------------------- */

const CATEGORIES = ["Todos", "Calderos", "Licuadoras", "Tostadoras", "Planchas", "Cucharones", "Sartenes", "Combos", "Otros"];
const STATUSES = ["Nuevo", "Preparando", "En camino", "Entregado"];
const TIERS = [
  { name: "Bronce", min: 0, emoji: "🥉", perk: "Acumula puntos en cada compra" },
  { name: "Plata", min: 500, emoji: "🥈", perk: "5% de descuento automático" },
  { name: "Oro", min: 1500, emoji: "🥇", perk: "10% de descuento + prioridad de entrega" },
];
const DEFAULT_CONFIG = {
  storeName: "Cocina Express",
  logo: "",
  whatsappNumber: "",
  phoneNumber: "",
  hoursOpen: "08:00",
  hoursClose: "18:00",
  aboutText: "Somos un negocio familiar en Comendador, Elías Piña, dedicado a llevar los mejores artículos de cocina directo a tu puerta.",
  aboutPhoto: "",
  bankInfo: "",
  adminPin: "1234",
  seasonalBanner: { active: false, text: "", emoji: "🎄" },
  tips: [],
  banners: [],
};

/* ---------------------------------- helpers ---------------------------------- */

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const money = (n) => "RD$ " + Math.round(n || 0).toLocaleString("es-DO");

function waLink(phone, message) {
  const clean = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function compressImage(file, maxWidth = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function generateDescription(base64Image, name, category) {
  // Llama a tu propia función serverless (/api/describe) en vez de a Claude
  // directamente, porque fuera de Claude.ai se necesita una clave de API
  // propia y no debe exponerse en el navegador. Ver api/describe.js.
  const response = await fetch("/api/describe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image, name, category }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (data.error === "no_api_key") {
      throw new Error("Configura tu clave ANTHROPIC_API_KEY en Vercel para usar esto, o escribe la descripción tú mismo.");
    }
    throw new Error(data.message || "No se pudo generar la descripción.");
  }
  return data.description || "";
}

function isStoreOpen(config, now) {
  try {
    const [oh, om] = config.hoursOpen.split(":").map(Number);
    const [ch, cm] = config.hoursClose.split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= oh * 60 + om && cur < ch * 60 + cm;
  } catch {
    return true;
  }
}

function tierFor(points) {
  let t = TIERS[0];
  for (const tier of TIERS) if (points >= tier.min) t = tier;
  return t;
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

/* ---------------------------------- storage layer (Firestore) ---------------------------------- */
/* Mismas firmas de función que la versión de Claude, para no tocar el resto
   de la app — solo cambia lo que hay adentro. */

async function loadProducts() {
  const items = await listDocs("products");
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function loadOrders() {
  const items = await listDocs("orders");
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

async function loadConfig() {
  const c = await getDocData("config", "store");
  return c ? { ...DEFAULT_CONFIG, ...c } : { ...DEFAULT_CONFIG };
}

async function loadCoupons() {
  const c = await getDocData("config", "coupons");
  return c?.list || [];
}

async function loadCustomer(phone) {
  if (!phone) return null;
  return await getDocData("customers", phone);
}

async function loadReviews(productId) {
  const r = await getDocData("reviews", productId);
  return r?.list || [];
}

const saveProduct = (p) => setDocData("products", p.id, p);
const deleteProductKey = (id) => deleteDocData("products", id);
const saveOrder = (o) => setDocData("orders", o.id, o);
const saveConfig = (c) => setDocData("config", "store", c);
const saveCoupons = (arr) => setDocData("config", "coupons", { list: arr });
const saveCustomer = (phone, obj) => setDocData("customers", phone, obj);
const saveReviews = (productId, arr) => setDocData("reviews", productId, { list: arr });

/* ---------------------------------- small UI atoms ---------------------------------- */

function Stamp({ children, tone = "red" }) {
  const tones = {
    red: "bg-red-600 text-white",
    gold: "bg-amber-500 text-white",
    green: "bg-emerald-600 text-white",
    dark: "bg-stone-900 text-white",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Stars({ value, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= value ? "fill-amber-500 text-amber-500" : "text-stone-300"} />
      ))}
    </div>
  );
}

function Spinner({ className = "" }) {
  return <div className={`animate-spin rounded-full border-2 border-white/40 border-t-white h-4 w-4 ${className}`} />;
}

/* ---------------------------------- Splash ---------------------------------- */

function Splash({ config }) {
  return (
    <div className="fixed inset-0 z-50 bg-red-600 flex flex-col items-center justify-center anim-splash-fade">
      <div className="anim-pop-in">
        {config.logo ? (
          <img src={config.logo} alt="logo" className="w-24 h-24 rounded-2xl object-cover shadow-xl mb-4" />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-white/15 flex items-center justify-center text-5xl mb-4">🍳</div>
        )}
      </div>
      <h1 className="text-white text-2xl font-black tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
        {config.storeName}
      </h1>
      <p className="text-white/70 text-xs mt-1">Comendador, Elías Piña</p>
    </div>
  );
}

/* ---------------------------------- Identify modal ---------------------------------- */

function IdentifyModal({ onClose, onIdentify }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-stone-900 mb-1">¿Cómo te llamas?</h3>
        <p className="text-sm text-stone-500 mb-4">Usamos tu WhatsApp para guardar tus favoritos, puntos y pedidos.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-red-600" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tu WhatsApp (809...)"
          inputMode="numeric" className="w-full border border-stone-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-red-600" />
        <button
          disabled={!name.trim() || phone.replace(/\D/g, "").length < 10 || busy}
          onClick={async () => {
            setBusy(true);
            await onIdentify(name.trim(), phone.replace(/\D/g, ""));
            setBusy(false);
          }}
          className="w-full bg-red-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
        >
          {busy ? <Spinner /> : "Continuar"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Header ---------------------------------- */

function Header({ config, cartCount, onCartClick, search, setSearch, customer, onIdentifyClick, screen, setScreen }) {
  return (
    <div className="sticky top-0 z-30 bg-red-600 shadow-md">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button onClick={() => setScreen("home")} className="flex items-center gap-2">
          {config.logo ? (
            <img src={config.logo} className="w-9 h-9 rounded-lg object-cover" />
          ) : (
            <span className="text-2xl">🍳</span>
          )}
          <div className="text-left">
            <div className="text-white font-black leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>{config.storeName}</div>
            <div className="text-white/70 text-xs flex items-center gap-1"><MapPin size={10} /> Entrega a tu puerta</div>
          </div>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={onIdentifyClick} className="text-white/90">
            <User size={22} />
          </button>
          <button onClick={onCartClick} className="relative text-white">
            <ShoppingCart size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar calderos, licuadoras, tostadoras..."
            className="w-full bg-white rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Hero Banner ---------------------------------- */

function HeroBanner({ config, onWhatsapp }) {
  const slides =
    config.banners && config.banners.length > 0
      ? config.banners
      : [{ title: `Entrega gratuita en ${"Comendador, Elías Piña"}`, subtitle: "Los mejores accesorios de cocina al mejor precio de la zona." }];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 text-white p-5 relative overflow-hidden min-h-40">
      {config.seasonalBanner?.active && (
        <div className="absolute top-3 right-3 text-2xl">{config.seasonalBanner.emoji}</div>
      )}
      <div key={i} className="anim-fade-in">
        <h2 className="text-xl font-black leading-snug pr-8" style={{ fontFamily: "'Fraunces', serif" }}>
          {config.seasonalBanner?.active && config.seasonalBanner.text ? config.seasonalBanner.text : slides[i].title}
        </h2>
        <p className="text-white/80 text-sm mt-1" style={{ maxWidth: "85%" }}>{slides[i].subtitle}</p>
      </div>
      <div className="flex gap-2 mt-4">
        <Stamp tone="gold">📦 Envío gratis</Stamp>
        {config.whatsappNumber && (
          <button onClick={onWhatsapp}>
            <Stamp tone="dark">💬 Pedidos por WhatsApp</Stamp>
          </button>
        )}
      </div>
      {slides.length > 1 && (
        <div className="flex gap-1.5 mt-4">
          {slides.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Category tabs ---------------------------------- */

function CategoryTabs({ active, setActive }) {
  return (
    <div className="flex gap-2 px-4 py-4 overflow-x-auto no-scrollbar">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          onClick={() => setActive(c)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
            active === c ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-600 border-stone-200"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- Product Card ---------------------------------- */

function ProductCard({ product, badges, weeklySales, isFav, onToggleFav, onOpen, onQuickAdd, now }) {
  const outOfStock = product.stock <= 0;
  const countdown = product.flashSaleEnd ? formatCountdown(new Date(product.flashSaleEnd).getTime() - now) : null;
  const discountPct =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;
  const [bounced, setBounced] = useState(false);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 relative">
      <button onClick={() => onOpen(product.id)} className="block w-full text-left">
        <div className="relative aspect-square bg-stone-100">
          {product.photos?.[0] ? (
            <img src={product.photos[0]} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">🍳</div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Stamp tone="dark">Agotado</Stamp>
            </div>
          )}
          {discountPct > 0 && !outOfStock && (
            <div className="absolute top-2 left-2">
              <Stamp tone="green">-{discountPct}%</Stamp>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1" style={{ maxWidth: "85%" }}>
            {badges.bestSeller && <Stamp tone="gold">⭐ Más vendido</Stamp>}
            {badges.isNew && <Stamp tone="dark">🆕 Nuevo</Stamp>}
            {!outOfStock && product.stock <= 3 && <Stamp tone="red">⏰ Últimas {product.stock}</Stamp>}
          </div>
        </div>
        <div className="p-3">
          <div className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">{product.name}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-black text-red-600">{money(product.price)}</span>
            {product.originalPrice > product.price && (
              <span className="text-xs text-stone-400 line-through">{money(product.originalPrice)}</span>
            )}
          </div>
          {countdown && (
            <div className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
              <Clock size={11} /> Oferta termina en {countdown}
            </div>
          )}
          {weeklySales > 0 && <div className="text-xs text-stone-400 mt-1">🔥 {weeklySales} vendidos esta semana</div>}
        </div>
      </button>
      <button
        onClick={() => onToggleFav(product.id)}
        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow"
      >
        <Heart size={15} className={isFav ? "fill-red-600 text-red-600" : "text-stone-400"} />
      </button>
      {!outOfStock && (
        <button
          onClick={() => {
            onQuickAdd(product.id);
            setBounced(true);
            setTimeout(() => setBounced(false), 500);
          }}
          className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center shadow-lg"
        >
          {bounced ? <span className="anim-bounce-in"><Check size={16} /></span> : <Plus size={16} />}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------- Product Grid ---------------------------------- */

function ProductGrid({ products, category, search, favorites, showFavoritesOnly, ordersAgg, isFav, onToggleFav, onOpen, onQuickAdd, now }) {
  let list = products;
  if (category !== "Todos") list = list.filter((p) => p.category === category);
  if (search.trim()) {
    const s = search.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s));
  }
  if (showFavoritesOnly) list = list.filter((p) => favorites.includes(p.id));

  const topSellers = [...ordersAgg.entries()].sort((a, b) => b[1].allTime - a[1].allTime).slice(0, 3).map((e) => e[0]);

  if (list.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400">
        <Package size={40} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">{showFavoritesOnly ? "Aún no tienes favoritos guardados." : "No encontramos productos con ese criterio."}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-6">
      {list.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          now={now}
          badges={{ bestSeller: topSellers.includes(p.id) && (ordersAgg.get(p.id)?.allTime || 0) > 0, isNew: Date.now() - p.createdAt < 7 * 86400000 }}
          weeklySales={ordersAgg.get(p.id)?.weekly || 0}
          isFav={favorites.includes(p.id)}
          onToggleFav={onToggleFav}
          onOpen={onOpen}
          onQuickAdd={onQuickAdd}
        />
      ))}
    </div>
  );
}

/* ---------------------------------- Product Detail ---------------------------------- */

function ProductDetail({ product, isFav, onToggleFav, onAddToCart, onClose, onShareWhatsapp, customer, onNeedIdentify, now }) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingReviews(true);
    loadReviews(product.id).then((r) => {
      if (alive) {
        setReviews(r);
        setLoadingReviews(false);
      }
    });
    return () => (alive = false);
  }, [product.id]);

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const outOfStock = product.stock <= 0;
  const countdown = product.flashSaleEnd ? formatCountdown(new Date(product.flashSaleEnd).getTime() - now) : null;

  async function submitReview(rating, comment, photo) {
    if (!customer) {
      onNeedIdentify();
      return;
    }
    const updated = [...reviews, { id: newId(), customerName: customer.name, rating, comment, photo, createdAt: Date.now() }];
    setReviews(updated);
    setShowReviewForm(false);
    await saveReviews(product.id, updated);
  }

  return (
    <div className="fixed inset-0 z-40 bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between border-b border-stone-100">
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center"><ChevronLeft size={22} /></button>
        <div className="flex gap-4">
          <button onClick={() => onToggleFav(product.id)}>
            <Heart size={20} className={isFav ? "fill-red-600 text-red-600" : "text-stone-400"} />
          </button>
          <button onClick={() => onShareWhatsapp(product)}><MessageCircle size={20} className="text-emerald-600" /></button>
        </div>
      </div>

      <div className="relative aspect-square bg-stone-100">
        {product.photos?.length ? (
          <img src={product.photos[photoIdx]} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🍳</div>
        )}
        {product.photos?.length > 1 && (
          <>
            <button onClick={() => setPhotoIdx((i) => (i - 1 + product.photos.length) % product.photos.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setPhotoIdx((i) => (i + 1) % product.photos.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {product.photos.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full ${i === photoIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-red-600 font-bold">{product.category}</div>
        <h1 className="text-xl font-black text-stone-900 mt-1" style={{ fontFamily: "'Fraunces', serif" }}>{product.name}</h1>
        <div className="flex items-center gap-2 mt-2">
          {reviews.length > 0 && (
            <>
              <Stars value={Math.round(avgRating)} />
              <span className="text-xs text-stone-500">({reviews.length})</span>
            </>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-2xl font-black text-red-600">{money(product.price)}</span>
          {product.originalPrice > product.price && <span className="text-sm text-stone-400 line-through">{money(product.originalPrice)}</span>}
        </div>
        {countdown && (
          <div className="text-sm text-red-600 font-semibold mt-2 flex items-center gap-1"><Clock size={14} /> Oferta relámpago: termina en {countdown}</div>
        )}
        <div className="mt-2 text-sm">
          {outOfStock ? (
            <span className="text-stone-400 font-semibold">Agotado — no disponible por ahora</span>
          ) : (
            <span className="text-emerald-600 font-semibold">Disponible: {product.stock} unidades</span>
          )}
        </div>

        {product.description && <p className="text-sm text-stone-600 mt-4 leading-relaxed">{product.description}</p>}
        {product.comboContents && (
          <div className="mt-3 bg-stone-50 rounded-xl p-3 text-sm">
            <span className="font-bold">Incluye: </span>{product.comboContents}
          </div>
        )}

        {!outOfStock && (
          <div className="flex items-center gap-3 mt-5">
            <div className="flex items-center border border-stone-200 rounded-xl">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center"><Minus size={16} /></button>
              <span className="w-8 text-center font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} className="w-10 h-10 flex items-center justify-center"><Plus size={16} /></button>
            </div>
            <button onClick={() => onAddToCart(product.id, qty)} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">
              Agregar al carrito
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-stone-900">Reseñas de clientes</h3>
            <button onClick={() => (customer ? setShowReviewForm(true) : onNeedIdentify())} className="text-sm text-red-600 font-semibold">
              + Escribir reseña
            </button>
          </div>
          {loadingReviews ? (
            <p className="text-sm text-stone-400">Cargando...</p>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-stone-400">Sé el primero en dejar una reseña.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="border border-stone-100 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{r.customerName}</span>
                    <Stars value={r.rating} size={12} />
                  </div>
                  {r.comment && <p className="text-sm text-stone-600 mt-1">{r.comment}</p>}
                  {r.photo && <img src={r.photo} className="w-20 h-20 rounded-lg object-cover mt-2" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showReviewForm && <ReviewForm onCancel={() => setShowReviewForm(false)} onSubmit={submitReview} />}
    </div>
  );
}

function ReviewForm({ onCancel, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-3">Tu reseña</h3>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} onClick={() => setRating(i)}><Star size={26} className={i <= rating ? "fill-amber-500 text-amber-500" : "text-stone-300"} /></button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Cuéntanos qué te pareció..."
          className="w-full border border-stone-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-red-600 text-sm" rows={3} />
        <label className="flex items-center gap-2 text-sm text-stone-500 mb-4 cursor-pointer">
          <Camera size={16} /> {photo ? "Foto agregada ✓" : "Agregar foto (opcional)"}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setPhoto(await compressImage(f, 600, 0.6));
          }} />
        </label>
        <button disabled={busy} onClick={async () => { setBusy(true); await onSubmit(rating, comment, photo); }}
          className="w-full bg-red-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
          {busy ? <Spinner /> : "Publicar reseña"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Cart Drawer ---------------------------------- */

function CartDrawer({ cart, products, onClose, onChangeQty, onCheckout }) {
  const items = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl flex flex-col" style={{ maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-stone-100">
          <h3 className="font-bold text-lg">Tu carrito</h3>
          <button onClick={onClose}><X size={22} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {items.length === 0 && <p className="text-center text-stone-400 py-8 text-sm">Tu carrito está vacío.</p>}
          {items.map((i) => (
            <div key={i.productId} className="flex gap-3 items-center">
              {i.product.photos?.[0] ? <img src={i.product.photos[0]} className="w-14 h-14 rounded-lg object-cover" /> : <div className="w-14 h-14 rounded-lg bg-stone-100" />}
              <div className="flex-1">
                <div className="text-sm font-semibold">{i.product.name}</div>
                <div className="text-sm text-red-600 font-bold">{money(i.product.price)}</div>
              </div>
              <div className="flex items-center border border-stone-200 rounded-lg">
                <button onClick={() => onChangeQty(i.productId, i.qty - 1)} className="w-8 h-8 flex items-center justify-center"><Minus size={14} /></button>
                <span className="w-6 text-center text-sm">{i.qty}</span>
                <button onClick={() => onChangeQty(i.productId, Math.min(i.product.stock, i.qty + 1))} className="w-8 h-8 flex items-center justify-center"><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="p-4 border-t border-stone-100">
            <div className="flex justify-between font-bold mb-3">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <button onClick={onCheckout} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl">Continuar al pago</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Checkout ---------------------------------- */

function Checkout({ cart, products, config, customer, coupons, onClose, onPlaceOrder }) {
  const items = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.productId) })).filter((i) => i.product);
  const subtotal = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const [address, setAddress] = useState("Comendador, Elías Piña");
  const [payment, setPayment] = useState("Efectivo contra entrega");
  const [couponCode, setCouponCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const tier = tierFor(customer?.points || 0);
  const tierDiscountPct = tier.name === "Oro" ? 10 : tier.name === "Plata" ? 5 : 0;
  const appliedCoupon = coupons.find((c) => c.active && c.code.toLowerCase() === couponCode.trim().toLowerCase());
  const couponDiscount = appliedCoupon ? (appliedCoupon.type === "percent" ? subtotal * (appliedCoupon.value / 100) : appliedCoupon.value) : 0;
  const tierDiscount = subtotal * (tierDiscountPct / 100);
  const total = Math.max(0, subtotal - couponDiscount - tierDiscount);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-stone-100">
        <button onClick={onClose}><ChevronLeft size={22} /></button>
        <h3 className="font-bold text-lg">Confirmar pedido</h3>
      </div>
      <div className="p-4 space-y-5">
        <div>
          <label className="text-sm font-semibold text-stone-900">Dirección de entrega</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-900">Método de pago</label>
          <div className="flex gap-2 mt-2">
            {["Efectivo contra entrega", "Transferencia bancaria"].map((m) => (
              <button key={m} onClick={() => setPayment(m)}
                className={`flex-1 text-xs font-semibold py-3 rounded-xl border ${payment === m ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"}`}>
                {m}
              </button>
            ))}
          </div>
          {payment === "Transferencia bancaria" && config.bankInfo && (
            <div className="mt-2 bg-stone-50 rounded-xl p-3 text-xs text-stone-600 whitespace-pre-wrap">{config.bankInfo}</div>
          )}
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-900">Cupón de descuento</label>
          <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Código (opcional)"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
        </div>
        <div>
          <label className="text-sm font-semibold text-stone-900">Nota para el pedido (opcional)</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
        </div>

        <div className="bg-stone-50 rounded-xl p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {tierDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento {tier.name} ({tierDiscountPct}%)</span><span>-{money(tierDiscount)}</span></div>}
          {couponDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Cupón {appliedCoupon.code}</span><span>-{money(couponDiscount)}</span></div>}
          <div className="flex justify-between font-black text-base pt-1 border-t border-stone-200"><span>Total</span><span className="text-red-600">{money(total)}</span></div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            const insufficient = items.find((i) => i.qty > i.product.stock);
            if (insufficient) {
              setError(`"${insufficient.product.name}" ya no tiene suficiente inventario.`);
              setBusy(false);
              return;
            }
            await onPlaceOrder({ items, address, payment, note, subtotal, tierDiscount, couponDiscount, total, couponCode: appliedCoupon?.code || "" });
            setBusy(false);
          }}
          className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
        >
          {busy ? <Spinner /> : `Confirmar pedido · ${money(total)}`}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Order Tracking ---------------------------------- */

function StatusBar({ status }) {
  const idx = STATUSES.indexOf(status);
  return (
    <div className="flex items-center mt-3">
      {STATUSES.map((s, i) => (
        <div key={s} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i <= idx ? "bg-emerald-600 text-white" : "bg-stone-200 text-stone-400"}`}>
              {i < idx ? <Check size={12} /> : i + 1}
            </div>
            <span className={`text-xs mt-1 text-center w-14 ${i <= idx ? "text-stone-900 font-semibold" : "text-stone-400"}`}>{s}</span>
          </div>
          {i < STATUSES.length - 1 && <div className={`flex-1 h-0.5 mb-4 ${i < idx ? "bg-emerald-600" : "bg-stone-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function OrdersScreen({ customer, orders, products, onIdentify, onReorder }) {
  if (!customer) {
    return (
      <div className="p-6 text-center">
        <Package size={36} className="mx-auto mb-3 text-stone-300" />
        <p className="text-stone-500 text-sm mb-4">Identifícate para ver tus pedidos.</p>
        <button onClick={onIdentify} className="bg-red-600 text-white font-bold px-6 py-3 rounded-xl">Identificarme</button>
      </div>
    );
  }
  const myOrders = orders.filter((o) => o.customerPhone === customer.phone);
  if (myOrders.length === 0) return <p className="text-center text-stone-400 text-sm py-10">Aún no tienes pedidos.</p>;

  return (
    <div className="p-4 space-y-4">
      {myOrders.map((o) => (
        <div key={o.id} className="border border-stone-100 rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs text-stone-400">Pedido #{o.id.slice(-5).toUpperCase()}</span>
            <span className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleDateString("es-DO")}</span>
          </div>
          <div className="text-sm mt-1 text-stone-600">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
          <div className="font-bold text-red-600 mt-1">{money(o.total)}</div>
          <StatusBar status={o.status} />
          {o.status === "Entregado" && (
            <button onClick={() => onReorder(o)} className="mt-3 w-full border border-red-600 text-red-600 font-semibold text-sm py-2 rounded-xl">
              🔁 Volver a pedir
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- About / Tips ---------------------------------- */

function AboutSection({ config, now }) {
  const open = isStoreOpen(config, now);
  return (
    <div className="p-4 space-y-6">
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <div className="flex items-center gap-3">
          {config.aboutPhoto ? <img src={config.aboutPhoto} className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-stone-50 flex items-center justify-center text-2xl">🍳</div>}
          <div>
            <h3 className="font-bold text-stone-900">Sobre nosotros</h3>
            <span className={`text-xs font-semibold ${open ? "text-emerald-600" : "text-red-600"}`}>
              {open ? "Abierto ahora" : `Cerrado, abrimos a las ${config.hoursOpen}`}
            </span>
          </div>
        </div>
        <p className="text-sm text-stone-600 mt-3 leading-relaxed">{config.aboutText}</p>
        <div className="flex gap-2 mt-4">
          {config.phoneNumber && (
            <a href={`tel:${config.phoneNumber}`} className="flex-1 flex items-center justify-center gap-2 border border-stone-200 rounded-xl py-2.5 text-sm font-semibold">
              <Phone size={15} /> Llamar
            </a>
          )}
          {config.whatsappNumber && (
            <a href={waLink(config.whatsappNumber, "Hola, tengo una pregunta sobre sus productos.")} target="_blank" rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-semibold">
              <MessageCircle size={15} /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {config.tips?.length > 0 && (
        <div>
          <h3 className="font-bold text-stone-900 mb-3">📖 Tips y recetas</h3>
          <div className="space-y-3">
            {config.tips.map((t, i) => (
              <div key={i} className="bg-stone-50 rounded-xl p-4">
                <div className="font-semibold text-sm text-stone-900">{t.title}</div>
                <p className="text-sm text-stone-600 mt-1">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-stone-400 pt-4 pb-2">CEO: Rodolfo Valdez Lebrón</div>
    </div>
  );
}

/* ---------------------------------- Admin ---------------------------------- */

function AdminLogin({ config, onUnlock, onClose }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full max-w-xs rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-1">Panel de administrador</h3>
        <p className="text-sm text-stone-500 mb-4">Ingresa tu PIN.</p>
        <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric"
          className="w-full border border-stone-200 rounded-xl px-4 py-3 mb-2 outline-none focus:border-red-600 text-center text-lg tracking-widest" />
        {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
        <button onClick={() => (pin === config.adminPin ? onUnlock() : setErr("PIN incorrecto"))}
          className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl">Entrar</button>
      </div>
    </div>
  );
}

function ProductForm({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || "Calderos");
  const [price, setPrice] = useState(initial?.price || "");
  const [originalPrice, setOriginalPrice] = useState(initial?.originalPrice || "");
  const [stock, setStock] = useState(initial?.stock ?? 10);
  const [description, setDescription] = useState(initial?.description || "");
  const [photos, setPhotos] = useState(initial?.photos || []);
  const [isCombo, setIsCombo] = useState(initial?.category === "Combos");
  const [comboContents, setComboContents] = useState(initial?.comboContents || "");
  const [flashSaleEnd, setFlashSaleEnd] = useState(initial?.flashSaleEnd || "");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []).slice(0, 4 - photos.length);
    for (const f of files) {
      const compressed = await compressImage(f, 700, 0.55);
      setPhotos((p) => [...p, compressed]);
    }
  }

  async function handleGenerateDescription() {
    if (!photos[0] || !name) return;
    setGenerating(true);
    try {
      const desc = await generateDescription(photos[0], name, category);
      setDescription(desc);
    } catch {
      setDescription("No se pudo generar la descripción automáticamente. Escríbela manualmente.");
    }
    setGenerating(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-stone-100">
        <button onClick={onCancel}><ChevronLeft size={22} /></button>
        <h3 className="font-bold text-lg">{initial ? "Editar producto" : "Nuevo producto"}</h3>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="text-sm font-semibold">Fotos (hasta 4)</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={p} className="w-20 h-20 rounded-xl object-cover" />
                <button onClick={() => setPhotos((ph) => ph.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -right-1.5 bg-stone-900 text-white rounded-full w-5 h-5 flex items-center justify-center"><X size={12} /></button>
              </div>
            ))}
            {photos.length < 4 && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-300 flex items-center justify-center cursor-pointer text-stone-400">
                <ImagePlus size={20} />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
        </div>

        <div>
          <label className="text-sm font-semibold">Categoría</label>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setIsCombo(e.target.value === "Combos"); }}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 bg-white">
            {CATEGORIES.filter((c) => c !== "Todos").map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {isCombo && (
          <div>
            <label className="text-sm font-semibold">¿Qué incluye el combo?</label>
            <input value={comboContents} onChange={(e) => setComboContents(e.target.value)} placeholder="Ej: Caldero + Cucharón + Sartén"
              className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-semibold">Precio (RD$)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
          </div>
          <div className="flex-1">
            <label className="text-sm font-semibold">Precio anterior (opcional)</label>
            <input value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} type="number" className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold">Inventario disponible</label>
          <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
        </div>

        <div>
          <label className="text-sm font-semibold">Oferta relámpago termina (opcional)</label>
          <input value={flashSaleEnd} onChange={(e) => setFlashSaleEnd(e.target.value)} type="datetime-local"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Descripción</label>
            <button disabled={!photos[0] || !name || generating} onClick={handleGenerateDescription}
              className="text-xs font-semibold text-red-600 flex items-center gap-1 disabled:opacity-40">
              {generating ? <Spinner className="border-t-red-600 border-red-600/30" /> : <Sparkles size={13} />} Generar con IA
            </button>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
        </div>

        <button
          disabled={!name || !price || saving}
          onClick={async () => {
            setSaving(true);
            const product = {
              id: initial?.id || newId(),
              name,
              category,
              price: Number(price),
              originalPrice: Number(originalPrice) || Number(price),
              stock: Number(stock),
              description,
              photos,
              comboContents: isCombo ? comboContents : "",
              flashSaleEnd: flashSaleEnd || "",
              createdAt: initial?.createdAt || Date.now(),
            };
            await saveProduct(product);
            setSaving(false);
            onSave(product);
          }}
          className="w-full bg-red-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
        >
          {saving ? <Spinner /> : "Guardar producto"}
        </button>
      </div>
    </div>
  );
}

function AdminPanel({ products, orders, config, coupons, onClose, onRefresh, onLock }) {
  const [tab, setTab] = useState("productos");
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: "", type: "percent", value: "" });
  const [newTip, setNewTip] = useState({ title: "", text: "" });
  const [newBanner, setNewBanner] = useState({ title: "", subtitle: "" });

  async function handleDelete(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    await deleteProductKey(id);
    onRefresh();
  }

  async function handleStatusChange(order, status) {
    const updated = { ...order, status };
    await saveOrder(updated);
    onRefresh();
  }

  function notifyMessage(order, status) {
    const templates = {
      Preparando: `¡Hola ${order.customerName}! Tu pedido #${order.id.slice(-5).toUpperCase()} en ${config.storeName} ya está en preparación. 🍳`,
      "En camino": `¡Tu pedido #${order.id.slice(-5).toUpperCase()} va en camino! 🚚 Te lo entregamos muy pronto.`,
      Entregado: `¡Gracias por tu compra, ${order.customerName}! Tu pedido #${order.id.slice(-5).toUpperCase()} fue entregado. Esperamos verte pronto de nuevo. ❤️`,
    };
    return templates[status] || `Tu pedido #${order.id.slice(-5).toUpperCase()} cambió a: ${status}`;
  }

  async function saveConfigChanges() {
    setSavingConfig(true);
    await saveConfig(localConfig);
    setSavingConfig(false);
    onRefresh();
  }

  if (showForm) {
    return <ProductForm initial={editing} onCancel={() => setShowForm(false)} onSave={() => { setShowForm(false); onRefresh(); }} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 bg-stone-900 px-4 py-3 flex items-center justify-between z-10">
        <h3 className="font-bold text-white text-lg">Panel admin</h3>
        <div className="flex gap-4">
          <button onClick={onLock} className="text-white/70"><LogOut size={20} /></button>
          <button onClick={onClose} className="text-white"><X size={22} /></button>
        </div>
      </div>
      <div className="flex gap-1 p-3 bg-stone-50 sticky top-14 z-10 overflow-x-auto no-scrollbar">
        {[["productos", "Productos"], ["pedidos", "Pedidos"], ["cupones", "Cupones"], ["ajustes", "Ajustes"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${tab === k ? "bg-red-600 text-white" : "bg-white text-stone-600 border border-stone-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "productos" && (
        <div className="p-4">
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="w-full bg-stone-900 text-white font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-2">
            <Plus size={16} /> Agregar producto
          </button>
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border border-stone-100 rounded-xl p-3">
                {p.photos?.[0] ? <img src={p.photos[0]} className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-stone-100" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-stone-500">{money(p.price)} · Stock: {p.stock}</div>
                </div>
                <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-stone-500"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(p.id)} className="text-red-500"><Trash2 size={16} /></button>
              </div>
            ))}
            {products.length === 0 && <p className="text-center text-stone-400 text-sm py-8">Aún no has agregado productos.</p>}
          </div>
        </div>
      )}

      {tab === "pedidos" && (
        <div className="p-4 space-y-3">
          {orders.length === 0 && <p className="text-center text-stone-400 text-sm py-8">Aún no hay pedidos.</p>}
          {orders.map((o) => (
            <div key={o.id} className="border border-stone-100 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{o.customerName} · {o.customerPhone}</span>
                <span className="text-stone-400 text-xs">{new Date(o.createdAt).toLocaleString("es-DO")}</span>
              </div>
              <div className="text-xs text-stone-500 mt-1">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
              <div className="text-xs text-stone-500">{o.address} · {o.payment}</div>
              <div className="font-bold text-red-600 mt-1">{money(o.total)}</div>
              <div className="flex items-center gap-2 mt-2">
                <select value={o.status} onChange={(e) => handleStatusChange(o, e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {config.whatsappNumber !== undefined && (
                  <a href={waLink(o.customerPhone, notifyMessage(o, o.status))} target="_blank" rel="noreferrer"
                    className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1">
                    <MessageCircle size={12} /> Notificar
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "cupones" && (
        <div className="p-4 space-y-4">
          <div className="border border-stone-100 rounded-xl p-3 space-y-2">
            <input placeholder="Código (ej: BIENVENIDA10)" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-600" />
            <div className="flex gap-2">
              <select value={newCoupon.type} onChange={(e) => setNewCoupon({ ...newCoupon, type: e.target.value })} className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="percent">% Porcentaje</option>
                <option value="fixed">RD$ Monto fijo</option>
              </select>
              <input placeholder="Valor" value={newCoupon.value} onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })} type="number"
                className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-red-600" />
            </div>
            <button onClick={async () => {
              if (!newCoupon.code || !newCoupon.value) return;
              const updated = [...coupons, { ...newCoupon, value: Number(newCoupon.value), active: true }];
              await saveCoupons(updated);
              setNewCoupon({ code: "", type: "percent", value: "" });
              onRefresh();
            }} className="w-full bg-stone-900 text-white text-sm font-semibold py-2.5 rounded-lg">Crear cupón</button>
          </div>
          <div className="space-y-2">
            {coupons.map((c, i) => (
              <div key={i} className="flex items-center justify-between border border-stone-100 rounded-xl p-3">
                <div>
                  <div className="font-semibold text-sm">{c.code}</div>
                  <div className="text-xs text-stone-500">{c.type === "percent" ? `${c.value}%` : money(c.value)} de descuento</div>
                </div>
                <div className="flex gap-3 items-center">
                  <button onClick={async () => { const u = coupons.map((x, idx) => idx === i ? { ...x, active: !x.active } : x); await saveCoupons(u); onRefresh(); }}>
                    {c.active ? <Eye size={16} className="text-emerald-600" /> : <EyeOff size={16} className="text-stone-400" />}
                  </button>
                  <button onClick={async () => { const u = coupons.filter((_, idx) => idx !== i); await saveCoupons(u); onRefresh(); }}><Trash2 size={16} className="text-red-500" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ajustes" && (
        <div className="p-4 space-y-5">
          <div>
            <label className="text-sm font-semibold">Logo de la tienda</label>
            <div className="flex items-center gap-3 mt-2">
              {localConfig.logo ? <img src={localConfig.logo} className="w-16 h-16 rounded-xl object-cover" /> : <div className="w-16 h-16 rounded-xl bg-stone-100 flex items-center justify-center text-2xl">🍳</div>}
              <label className="text-sm text-red-600 font-semibold cursor-pointer">
                Cambiar logo
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setLocalConfig({ ...localConfig, logo: await compressImage(f, 300, 0.8) });
                }} />
              </label>
            </div>
            <p className="text-xs text-stone-400 mt-1">Este logo aparece en la app. Para usarlo como ícono al agregar la app a la pantalla de inicio del teléfono, cada cliente debe usar "Agregar a inicio" desde el navegador (ver nota abajo).</p>
          </div>

          <div>
            <label className="text-sm font-semibold">Nombre de la tienda</label>
            <input value={localConfig.storeName} onChange={(e) => setLocalConfig({ ...localConfig, storeName: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-semibold">WhatsApp (con código país)</label>
              <input value={localConfig.whatsappNumber} onChange={(e) => setLocalConfig({ ...localConfig, whatsappNumber: e.target.value })} placeholder="18095551234"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold">Teléfono para llamadas</label>
              <input value={localConfig.phoneNumber} onChange={(e) => setLocalConfig({ ...localConfig, phoneNumber: e.target.value })} placeholder="8095551234"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-semibold">Abre a las</label>
              <input value={localConfig.hoursOpen} onChange={(e) => setLocalConfig({ ...localConfig, hoursOpen: e.target.value })} type="time"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-semibold">Cierra a las</label>
              <input value={localConfig.hoursClose} onChange={(e) => setLocalConfig({ ...localConfig, hoursClose: e.target.value })} type="time"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold">Sobre nosotros</label>
            <textarea value={localConfig.aboutText} onChange={(e) => setLocalConfig({ ...localConfig, aboutText: e.target.value })} rows={3}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
          </div>

          <div>
            <label className="text-sm font-semibold">Datos para transferencia bancaria</label>
            <textarea value={localConfig.bankInfo} onChange={(e) => setLocalConfig({ ...localConfig, bankInfo: e.target.value })} rows={2} placeholder="Banco, cuenta, nombre..."
              className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600 text-sm" />
          </div>

          <div className="border border-stone-100 rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={localConfig.seasonalBanner?.active || false}
                onChange={(e) => setLocalConfig({ ...localConfig, seasonalBanner: { ...localConfig.seasonalBanner, active: e.target.checked } })} />
              Banner especial de temporada
            </label>
            {localConfig.seasonalBanner?.active && (
              <div className="flex gap-2 mt-2">
                <input value={localConfig.seasonalBanner.emoji} onChange={(e) => setLocalConfig({ ...localConfig, seasonalBanner: { ...localConfig.seasonalBanner, emoji: e.target.value } })}
                  className="w-14 border border-stone-200 rounded-lg px-2 py-2 text-center text-lg" />
                <input value={localConfig.seasonalBanner.text} onChange={(e) => setLocalConfig({ ...localConfig, seasonalBanner: { ...localConfig.seasonalBanner, text: e.target.value } })}
                  placeholder="¡Feliz Navidad! Ofertas especiales 🎄" className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold">Cambiar PIN de administrador</label>
            <input value={localConfig.adminPin} onChange={(e) => setLocalConfig({ ...localConfig, adminPin: e.target.value })}
              className="w-full border border-stone-200 rounded-xl px-4 py-3 mt-1 outline-none focus:border-red-600" />
          </div>

          <div>
            <label className="text-sm font-semibold">Tips y recetas</label>
            <div className="space-y-2 mt-2">
              {(localConfig.tips || []).map((t, i) => (
                <div key={i} className="flex items-center justify-between bg-stone-50 rounded-lg p-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  <button onClick={() => setLocalConfig({ ...localConfig, tips: localConfig.tips.filter((_, idx) => idx !== i) })}><Trash2 size={14} className="text-red-500" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={newTip.title} onChange={(e) => setNewTip({ ...newTip, title: e.target.value })} placeholder="Título" className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={newTip.text} onChange={(e) => setNewTip({ ...newTip, text: e.target.value })} placeholder="Texto del tip o receta" rows={2}
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-2" />
            <button onClick={() => { if (!newTip.title) return; setLocalConfig({ ...localConfig, tips: [...(localConfig.tips || []), newTip] }); setNewTip({ title: "", text: "" }); }}
              className="w-full bg-stone-100 text-sm font-semibold py-2 rounded-lg mt-2">+ Agregar tip</button>
          </div>

          <div>
            <label className="text-sm font-semibold">Banners promocionales del inicio</label>
            <div className="space-y-2 mt-2">
              {(localConfig.banners || []).map((b, i) => (
                <div key={i} className="flex items-center justify-between bg-stone-50 rounded-lg p-2 text-sm">
                  <span className="truncate">{b.title}</span>
                  <button onClick={() => setLocalConfig({ ...localConfig, banners: localConfig.banners.filter((_, idx) => idx !== i) })}><Trash2 size={14} className="text-red-500" /></button>
                </div>
              ))}
            </div>
            <input value={newBanner.title} onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })} placeholder="Título del banner" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-2" />
            <input value={newBanner.subtitle} onChange={(e) => setNewBanner({ ...newBanner, subtitle: e.target.value })} placeholder="Subtítulo" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-2" />
            <button onClick={() => { if (!newBanner.title) return; setLocalConfig({ ...localConfig, banners: [...(localConfig.banners || []), newBanner] }); setNewBanner({ title: "", subtitle: "" }); }}
              className="w-full bg-stone-100 text-sm font-semibold py-2 rounded-lg mt-2">+ Agregar banner</button>
          </div>

          <button disabled={savingConfig} onClick={saveConfigChanges} className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2">
            {savingConfig ? <Spinner /> : "Guardar ajustes"}
          </button>

          <div className="bg-stone-50 rounded-xl p-4 text-xs text-stone-500 leading-relaxed">
            💡 Para que la app se vea como una app: dile a tus clientes que abran el enlace en Chrome o Safari y usen "Agregar a pantalla de inicio". Así el ícono con tu logo queda en su teléfono, sin necesidad de Play Store.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Bottom Nav ---------------------------------- */

function BottomNav({ screen, setScreen, cartCount, adminAccess }) {
  const items = [
    { key: "home", icon: Home, label: "Inicio" },
    { key: "favorites", icon: Heart, label: "Favoritos" },
    { key: "orders", icon: Package, label: "Pedidos" },
    { key: "about", icon: User, label: "Nosotros" },
    ...(adminAccess ? [{ key: "admin", icon: Settings, label: "Admin" }] : []),
  ];
  return (
    <div className="sticky bottom-0 bg-white border-t border-stone-100 flex justify-around py-2 z-30">
      {items.map((it) => (
        <button key={it.key} onClick={() => setScreen(it.key)} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${screen === it.key ? "text-red-600" : "text-stone-400"}`}>
          <it.icon size={20} />
          <span className="text-xs font-medium">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- MAIN APP ---------------------------------- */

export default function CocinaExpressApp() {
  const [adminAccess] = useState(() => {
    try {
      return window.location.hash.toLowerCase().includes("rvladmin");
    } catch {
      return false;
    }
  });
  const [showSplash, setShowSplash] = useState(true);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [coupons, setCoupons] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [screen, setScreen] = useState("home");
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showIdentify, setShowIdentify] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(null);

  const refresh = useCallback(async () => {
    const [p, o, c, cp] = await Promise.all([loadProducts(), loadOrders(), loadConfig(), loadCoupons()]);
    setProducts(p);
    setOrders(o);
    setConfig(c);
    setCoupons(cp);
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
    const t = setTimeout(() => setShowSplash(false), 1400);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearTimeout(t); clearInterval(tick); };
  }, [refresh]);

  useEffect(() => {
    // Cuando el admin sube su propio logo, lo usamos como ícono de pestaña
    // y como ícono al "Agregar a inicio" en iPhone. El ícono de Android
    // (que viene del manifest.json) sigue siendo el caldero por defecto,
    // salvo que reemplaces manualmente los archivos icon-192.png/icon-512.png.
    if (config.logo) {
      const fav = document.getElementById("favicon-icon");
      const apple = document.getElementById("apple-touch-icon");
      if (fav) fav.href = config.logo;
      if (apple) apple.href = config.logo;
    }
    if (config.storeName) document.title = config.storeName;
  }, [config.logo, config.storeName]);

  useEffect(() => {
    if (screen !== "admin") setShowAdminLogin(false);
    if (screen === "admin" && !adminAccess) { setScreen("home"); return; }
    if (screen === "admin" && !adminUnlocked) setShowAdminLogin(true);
  }, [screen, adminUnlocked]);

  async function handleIdentify(name, phone) {
    let existing = await loadCustomer(phone);
    let isReturning = !!existing;
    if (!existing) {
      existing = { name, phone, points: 0, favorites: [], orderHistory: [], createdAt: Date.now() };
      await saveCustomer(phone, existing);
    } else if (existing.name !== name) {
      existing = { ...existing, name };
      await saveCustomer(phone, existing);
    }
    setCustomer(existing);
    setShowIdentify(false);
    if (isReturning) {
      setWelcomeMsg(`¡Qué bueno verte de nuevo, ${existing.name}! 👋`);
      setTimeout(() => setWelcomeMsg(""), 3500);
    }
  }

  function toggleFavorite(productId) {
    if (!customer) {
      setShowIdentify(true);
      return;
    }
    const has = customer.favorites.includes(productId);
    const favorites = has ? customer.favorites.filter((id) => id !== productId) : [...customer.favorites, productId];
    const updated = { ...customer, favorites };
    setCustomer(updated);
    saveCustomer(customer.phone, updated);
  }

  function addToCart(productId, qty = 1) {
    setCart((c) => {
      const existing = c.find((i) => i.productId === productId);
      if (existing) return c.map((i) => (i.productId === productId ? { ...i, qty: i.qty + qty } : i));
      return [...c, { productId, qty }];
    });
  }

  function changeQty(productId, qty) {
    setCart((c) => (qty <= 0 ? c.filter((i) => i.productId !== productId) : c.map((i) => (i.productId === productId ? { ...i, qty } : i))));
  }

  function shareProductWhatsapp(product) {
    const msg = `Mira este producto en ${config.storeName}: *${product.name}* — ${money(product.price)}. ¡Pídelo por entrega a domicilio en Comendador!`;
    window.open(waLink("", msg).replace("https://wa.me/?", "https://wa.me/?"), "_blank");
  }

  async function placeOrder({ items, address, payment, note, subtotal, tierDiscount, couponDiscount, total, couponCode }) {
    const order = {
      id: newId(),
      customerName: customer.name,
      customerPhone: customer.phone,
      items: items.map((i) => ({ productId: i.productId, name: i.product.name, price: i.product.price, qty: i.qty })),
      address,
      payment,
      note,
      subtotal,
      tierDiscount,
      couponDiscount,
      total,
      couponCode,
      status: "Nuevo",
      createdAt: Date.now(),
    };
    await saveOrder(order);

    for (const i of items) {
      const p = products.find((pp) => pp.id === i.productId);
      if (p) await saveProduct({ ...p, stock: Math.max(0, p.stock - i.qty) });
    }

    const newPoints = customer.points + Math.floor(total / 100);
    const newHistory = [...customer.orderHistory, order.id];
    const updatedCustomer = { ...customer, points: newPoints, orderHistory: newHistory };
    await saveCustomer(customer.phone, updatedCustomer);
    setCustomer(updatedCustomer);

    if (config.whatsappNumber) {
      const lines = [
        `🛒 *Nuevo pedido - ${config.storeName}*`,
        `Cliente: ${customer.name} (${customer.phone})`,
        `Dirección: ${address}`,
        ``,
        ...items.map((i) => `- ${i.qty} x ${i.product.name} — ${money(i.product.price * i.qty)}`),
        ``,
        `Total: ${money(total)}`,
        `Pago: ${payment}`,
        note ? `Nota: ${note}` : "",
        `Pedido #${order.id.slice(-5).toUpperCase()}`,
      ].filter(Boolean);
      window.open(waLink(config.whatsappNumber, lines.join("\n")), "_blank");
    }

    setCart([]);
    setShowCheckout(false);
    setShowCart(false);
    setOrderSuccess(order);
    await refresh();
  }

  function handleReorder(order) {
    const newCart = order.items
      .map((i) => {
        const p = products.find((pp) => pp.id === i.productId);
        if (!p || p.stock <= 0) return null;
        return { productId: i.productId, qty: Math.min(i.qty, p.stock) };
      })
      .filter(Boolean);
    setCart(newCart);
    setShowCart(true);
  }

  const ordersAgg = new Map();
  for (const o of orders) {
    const isWeekly = Date.now() - o.createdAt < 7 * 86400000;
    for (const item of o.items) {
      const entry = ordersAgg.get(item.productId) || { allTime: 0, weekly: 0 };
      entry.allTime += item.qty;
      if (isWeekly) entry.weekly += item.qty;
      ordersAgg.set(item.productId, entry);
    }
  }

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Spinner className="border-t-red-600 border-red-600/30 w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col max-w-lg mx-auto relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;800&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeOut { 0% {opacity:1;} 75% {opacity:1;} 100% {opacity:0; visibility:hidden;} }
        @keyframes popIn { 0% {transform:scale(0.7); opacity:0;} 100% {transform:scale(1); opacity:1;} }
        @keyframes fadeIn { 0% {opacity:0; transform:translateY(4px);} 100% {opacity:1; transform:translateY(0);} }
        @keyframes bounceIn { 0% {transform:scale(0.5);} 60% {transform:scale(1.3);} 100% {transform:scale(1);} }
        .no-scrollbar::-webkit-scrollbar { display:none; }
        .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
        .anim-splash-fade { animation: fadeOut 1.4s ease forwards; }
        .anim-pop-in { animation: popIn 0.6s ease; }
        .anim-fade-in { animation: fadeIn 0.5s ease; }
        .anim-fade-in-fast { animation: fadeIn 0.3s ease; }
        .anim-bounce-in { animation: bounceIn 0.4s ease; }
      `}</style>

      {showSplash && <Splash config={config} />}

      <Header
        config={config}
        cartCount={cartCount}
        onCartClick={() => setShowCart(true)}
        search={search}
        setSearch={setSearch}
        customer={customer}
        onIdentifyClick={() => (customer ? setScreen("orders") : setShowIdentify(true))}
        screen={screen}
        setScreen={setScreen}
      />

      {welcomeMsg && (
        <div className="bg-emerald-600 text-white text-sm text-center py-2 px-4 anim-fade-in-fast">{welcomeMsg}</div>
      )}

      {customer && (
        <div className="px-4 pt-3 flex items-center gap-2 text-xs text-stone-500">
          <Award size={13} className="text-amber-500" />
          <span>{tierFor(customer.points).emoji} Nivel {tierFor(customer.points).name} · {customer.points} puntos</span>
        </div>
      )}

      <div className="flex-1">
        {screen === "home" && (
          <>
            <HeroBanner config={config} onWhatsapp={() => window.open(waLink(config.whatsappNumber, "Hola, quiero hacer un pedido."), "_blank")} />
            <CategoryTabs active={category} setActive={setCategory} />
            <ProductGrid
              products={products} category={category} search={search}
              favorites={customer?.favorites || []} showFavoritesOnly={false}
              ordersAgg={ordersAgg} isFav={(id) => customer?.favorites?.includes(id)}
              onToggleFav={toggleFavorite} onOpen={(id) => setSelectedProductId(id)}
              onQuickAdd={(id) => addToCart(id, 1)} now={now}
            />
          </>
        )}

        {screen === "favorites" && (
          <>
            <div className="px-4 pt-4"><h2 className="font-black text-lg" style={{ fontFamily: "'Fraunces', serif" }}>❤️ Tus favoritos</h2></div>
            <ProductGrid
              products={products} category="Todos" search=""
              favorites={customer?.favorites || []} showFavoritesOnly={true}
              ordersAgg={ordersAgg} isFav={(id) => customer?.favorites?.includes(id)}
              onToggleFav={toggleFavorite} onOpen={(id) => setSelectedProductId(id)}
              onQuickAdd={(id) => addToCart(id, 1)} now={now}
            />
          </>
        )}

        {screen === "orders" && (
          <OrdersScreen customer={customer} orders={orders} products={products} onIdentify={() => setShowIdentify(true)} onReorder={handleReorder} />
        )}

        {screen === "about" && <AboutSection config={config} now={new Date(now)} />}

        {screen === "admin" && !adminUnlocked && !showAdminLogin && (
          <div className="p-6 text-center text-sm text-stone-400">Panel de administrador</div>
        )}

        {screen === "admin" && adminUnlocked && (
          <AdminPanel
            products={products} orders={orders} config={config} coupons={coupons}
            onClose={() => setScreen("home")} onRefresh={refresh}
            onLock={() => { setAdminUnlocked(false); setScreen("home"); }}
          />
        )}
      </div>

      <BottomNav screen={screen} setScreen={setScreen} cartCount={cartCount} adminAccess={adminAccess} />

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct} now={now}
          isFav={customer?.favorites?.includes(selectedProduct.id)}
          onToggleFav={toggleFavorite}
          onAddToCart={(id, qty) => { addToCart(id, qty); setSelectedProductId(null); setShowCart(true); }}
          onClose={() => setSelectedProductId(null)}
          onShareWhatsapp={shareProductWhatsapp}
          customer={customer}
          onNeedIdentify={() => setShowIdentify(true)}
        />
      )}

      {showCart && (
        <CartDrawer cart={cart} products={products} onClose={() => setShowCart(false)} onChangeQty={changeQty}
          onCheckout={() => (customer ? setShowCheckout(true) : setShowIdentify(true))} />
      )}

      {showCheckout && customer && (
        <Checkout cart={cart} products={products} config={config} customer={customer} coupons={coupons}
          onClose={() => setShowCheckout(false)} onPlaceOrder={placeOrder} />
      )}

      {showIdentify && <IdentifyModal onClose={() => setShowIdentify(false)} onIdentify={handleIdentify} />}

      {showAdminLogin && (
        <AdminLogin config={config} onClose={() => { setShowAdminLogin(false); setScreen("home"); }} onUnlock={() => { setAdminUnlocked(true); setShowAdminLogin(false); }} />
      )}

      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setOrderSuccess(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-xs text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-emerald-600/10 flex items-center justify-center mx-auto mb-3">
              <Check size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-bold text-lg">¡Pedido confirmado!</h3>
            <p className="text-sm text-stone-500 mt-1">Te avisaremos por WhatsApp sobre el estado de tu pedido #{orderSuccess.id.slice(-5).toUpperCase()}.</p>
            <button onClick={() => { setOrderSuccess(null); setScreen("orders"); }} className="w-full bg-red-600 text-white font-bold py-3 rounded-xl mt-4">Ver mi pedido</button>
          </div>
        </div>
      )}
    </div>
  );
}
