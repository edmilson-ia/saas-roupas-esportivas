import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "@/components/Auth";
import StoreLayout from "@/components/StoreLayout";
import { LoginPage, SignupPage } from "@/pages/AuthPages";
import Catalog from "@/pages/store/Catalog";
import CartPage from "@/pages/store/CartPage";
import CheckoutPage from "@/pages/store/CheckoutPage";

// painel e página do produto (com o editor) só são baixados quando acessados
const DashboardLayout = lazy(() => import("@/pages/dashboard/DashboardLayout"));
const Overview = lazy(() => import("@/pages/dashboard/Overview"));
const Products = lazy(() => import("@/pages/dashboard/Products"));
const Orders = lazy(() => import("@/pages/dashboard/Orders"));
const Settings = lazy(() => import("@/pages/dashboard/Settings"));
const ProductPage = lazy(() => import("@/pages/store/ProductPage"));
const MasterPanel = lazy(() => import("@/pages/master/MasterPanel")); // área do dono, em arquivo separado

function Home() {
  useEffect(() => {
    document.title = "Gold'n Ports · Camisas personalizadas";
  }, []);
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <img src="/logo.png" alt="Gold'n Ports" width={520} height={247} className="h-32 w-auto rounded-xl bg-brand-900 p-4" />
      <h1 className="text-3xl font-bold">Uniformes e camisas personalizadas</h1>
      <p className="text-slate-600">
        Crie sua loja de roupas esportivas, receba pedidos com nome, número e brasão já montados no editor.
      </p>
      <div className="flex gap-3">
        <Link to="/cadastrar" className="btn">Criar minha loja</Link>
        <Link to="/entrar" className="btn-secondary">Entrar</Link>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <Link to="/" className="btn">Voltar ao início</Link>
    </main>
  );
}

export default function App() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Carregando...</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/cadastrar" element={<SignupPage />} />

        <Route path="/painel" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="produtos" element={<Products />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="configuracoes" element={<Settings />} />
        </Route>

        <Route path="/master" element={<RequireAuth><MasterPanel /></RequireAuth>} />

        <Route path="/loja/:slug" element={<StoreLayout />}>
          <Route index element={<Catalog />} />
          <Route path="produto/:id" element={<ProductPage />} />
          <Route path="carrinho" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
        </Route>

        {/* endereços antigos da versão Next */}
        <Route path="/login" element={<Navigate to="/entrar" replace />} />
        <Route path="/signup" element={<Navigate to="/cadastrar" replace />} />
        <Route path="/dashboard/*" element={<Navigate to="/painel" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
