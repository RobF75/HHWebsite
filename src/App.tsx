import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import HomePage from './pages/HomePage';
import SpeciesPage from './pages/SpeciesPage';
import CultivarPage from './pages/CultivarPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrderPage from './pages/OrderPage';
import MyOrdersPage from './pages/MyOrdersPage';
import TradeAccountPage from './pages/TradeAccountPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="order" element={<RequireAuth><OrderPage /></RequireAuth>} />
        <Route path="account/orders" element={<RequireAuth><MyOrdersPage /></RequireAuth>} />
        <Route path="account/trade" element={<RequireAuth><TradeAccountPage /></RequireAuth>} />
        <Route path="cultivar/:id" element={<CultivarPage />} />
        <Route path=":speciesSlug" element={<SpeciesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
