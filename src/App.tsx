import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import RequireSite from './components/RequireSite';
import HomePage from './pages/HomePage';
import SpeciesPage from './pages/SpeciesPage';
import CultivarPage from './pages/CultivarPage';
import ProductPage from './pages/ProductPage';
import HarvestCalendarPage from './pages/HarvestCalendarPage';
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
        <Route path="login" element={<RequireSite feature="shop"><LoginPage /></RequireSite>} />
        <Route path="register" element={<RequireSite feature="shop"><RegisterPage /></RequireSite>} />
        <Route path="order" element={<RequireSite feature="shop"><RequireAuth><OrderPage /></RequireAuth></RequireSite>} />
        <Route path="account/orders" element={<RequireSite feature="shop"><RequireAuth><MyOrdersPage /></RequireAuth></RequireSite>} />
        <Route path="account/trade" element={<RequireSite feature="shop"><RequireAuth><TradeAccountPage /></RequireAuth></RequireSite>} />
        <Route path="cultivar/:id" element={<CultivarPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        {/* Must stay above :speciesSlug conceptually — a static segment outranks
            a dynamic one in the router's own scoring, but leaving it below would
            read as though "harvest-calendar" were a species. */}
        <Route path="harvest-calendar" element={<RequireSite feature="platform"><HarvestCalendarPage /></RequireSite>} />
        <Route path=":speciesSlug" element={<SpeciesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
