import Dashboard from './pages/Dashboard';
import Franchises from './pages/Franchises';
import UserManagement from './pages/UserManagement';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import FranchiseSettings from './pages/FranchiseSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Franchises": Franchises,
    "UserManagement": UserManagement,
    "Sales": Sales,
    "Reports": Reports,
    "FranchiseSettings": FranchiseSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};