import Dashboard from './pages/Dashboard';
import FranchiseSettings from './pages/FranchiseSettings';
import Franchises from './pages/Franchises';
import Home from './pages/Home';
import Reports from './pages/Reports';
import Sales from './pages/Sales';
import UserManagement from './pages/UserManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "FranchiseSettings": FranchiseSettings,
    "Franchises": Franchises,
    "Home": Home,
    "Reports": Reports,
    "Sales": Sales,
    "UserManagement": UserManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};