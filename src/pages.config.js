/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import { lazy } from 'react';

// Static imports — only critical first-paint pages loaded eagerly
import Dashboard from './pages/Dashboard';
import Vendas from './pages/Vendas';
import __Layout from './Layout.jsx';

// Lazy imports — all other pages loaded on demand
const Acompanhamento = lazy(() => import('./pages/Acompanhamento'));
const FranchiseSettings = lazy(() => import('./pages/FranchiseSettings'));
const Franchises = lazy(() => import('./pages/Franchises'));
const Gestao = lazy(() => import('./pages/Gestao'));
const Marketing = lazy(() => import('./pages/Marketing'));
const MinhaLoja = lazy(() => import('./pages/MinhaLoja'));
const MyChecklist = lazy(() => import('./pages/MyChecklist'));
const MyContacts = lazy(() => import('./pages/MyContacts'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Reports = lazy(() => import('./pages/Reports'));
const Tutoriais = lazy(() => import('./pages/Tutoriais'));


export const PAGES = {
    "Acompanhamento": Acompanhamento,

    "Dashboard": Dashboard,
    "FranchiseSettings": FranchiseSettings,
    "Franchises": Franchises,
    "Gestao": Gestao,
    "Marketing": Marketing,
    "MinhaLoja": MinhaLoja,
    "MyChecklist": MyChecklist,
    "MyContacts": MyContacts,
    "Onboarding": Onboarding,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
    "Tutoriais": Tutoriais,
    "Vendas": Vendas,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};