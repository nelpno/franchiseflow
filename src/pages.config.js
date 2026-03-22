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

// Static imports — lightweight pages loaded eagerly
import Dashboard from './pages/Dashboard';
import MinhaLoja from './pages/MinhaLoja';
import MyChecklist from './pages/MyChecklist';
import MyContacts from './pages/MyContacts';
import __Layout from './Layout.jsx';

// Lazy imports — heavy pages loaded on demand
const Acompanhamento = lazy(() => import('./pages/Acompanhamento'));
const FranchiseSettings = lazy(() => import('./pages/FranchiseSettings'));
const Franchises = lazy(() => import('./pages/Franchises'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Reports = lazy(() => import('./pages/Reports'));


export const PAGES = {
    "Acompanhamento": Acompanhamento,

    "Dashboard": Dashboard,
    "FranchiseSettings": FranchiseSettings,
    "Franchises": Franchises,
    "Marketing": Marketing,
    "MinhaLoja": MinhaLoja,
    "MyChecklist": MyChecklist,
    "MyContacts": MyContacts,
    "Onboarding": Onboarding,
    "PurchaseOrders": PurchaseOrders,
    "Reports": Reports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};