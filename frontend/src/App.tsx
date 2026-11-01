import { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/context/app-context';
import type { Screen } from '@/context/app-context';
import { CustomerThemeProvider } from '@/context/ThemeContext';
import { AdminThemeProvider } from '@/context/AdminThemeContext';
import { PhoneShell } from '@/components/PhoneShell';
import { BottomNav } from '@/components/BottomNav';
import { WebTopNav } from '@/components/WebTopNav';
import { ProviderLocationPublisher } from '@/components/ProviderLocationPublisher';
import { AssistantLauncher } from '@/components/AssistantLauncher';
import { AssistantScreen } from '@/screens/shared/AssistantScreen';
import { AdminSidebar } from '@/screens/admin/AdminSidebar';

import { SplashScreen } from '@/screens/customer/SplashScreen';
import { AuthScreen } from '@/screens/customer/AuthScreen';
import { HomeScreen } from '@/screens/customer/HomeScreen';
import { ServicesScreen } from '@/screens/customer/ServicesScreen';
import { SearchScreen } from '@/screens/customer/SearchScreen';
import { NotificationsScreen } from '@/screens/customer/NotificationsScreen';
import { CategoryScreen } from '@/screens/customer/CategoryScreen';
import { ServiceDetailScreen } from '@/screens/customer/ServiceDetailScreen';
import { ProfessionalListScreen } from '@/screens/customer/ProfessionalListScreen';
import { ProfessionalProfileScreen } from '@/screens/customer/ProfessionalProfileScreen';
import { BookingFlowScreen } from '@/screens/customer/BookingFlowScreen';
import { PaymentScreen } from '@/screens/customer/PaymentScreen';
import { BookingSuccessScreen } from '@/screens/customer/BookingSuccessScreen';
import { TrackingScreen } from '@/screens/customer/TrackingScreen';
import { InvoiceScreen } from '@/screens/InvoiceScreen';
import { MyBookingsScreen } from '@/screens/customer/MyBookingsScreen';
import { ReviewScreen } from '@/screens/customer/ReviewScreen';
import { ProfileScreen } from '@/screens/customer/ProfileScreen';
import { HelpScreen } from '@/screens/customer/HelpScreen';
import { RefundsScreen } from '@/screens/customer/RefundsScreen';
import { AddressesScreen } from '@/screens/customer/AddressesScreen';
import { FavouritesScreen } from '@/screens/customer/FavouritesScreen';

import { ProviderHomeScreen } from '@/screens/provider/ProviderHomeScreen';
import { ProviderAuthScreen } from '@/screens/provider/ProviderAuthScreen';
import { ProviderBookingsScreen } from '@/screens/provider/ProviderBookingsScreen';
import { ProviderEarningsScreen } from '@/screens/provider/ProviderEarningsScreen';
import { ProviderProfileScreen } from '@/screens/provider/ProviderProfileScreen';
import { ProviderDetailScreen } from '@/screens/provider/ProviderDetailScreen';

import { AdminDashboard } from '@/screens/admin/AdminDashboard';
import { AdminLoginScreen } from '@/screens/admin/AdminLoginScreen';
import {
  AdminCustomers,
  AdminProviders,
  AdminServices,
  AdminBookings,
  AdminProfile,
  AdminCoupons,
  AdminPayouts,
  AdminRefunds,
  AdminDisputes,
  AdminNotifications,
} from '@/screens/admin/AdminScreens';

function AssistantPanel() {
  const { back } = useApp();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={back}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl dark:bg-gray-950 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <AssistantScreen />
      </div>
    </div>
  );
}

function Router() {
  const { screen, role, adminAuthed } = useApp();
  const [bgScreen, setBgScreen] = useState<Screen | null>(null);

  // Remember the last non-assistant screen so it shows behind the assistant
  // panel while the assistant is open.
  useEffect(() => {
    if (screen.name !== 'assistant') {
      setBgScreen(screen);
    }
  }, [screen]);

  const assistantOpen = screen.name === 'assistant';
  const displayScreen = assistantOpen ? (bgScreen ?? screen) : screen;

  if (role === 'admin') {
    if (!adminAuthed) {
      return (
        <div className="min-h-screen bg-gray-100">
          <AdminLoginScreen />
        </div>
      );
    }

    return (
      <AdminThemeProvider>
        <div className="flex h-screen min-h-screen overflow-hidden">
          <AdminSidebar />
          <div key={screen.name} className="flex flex-1 flex-col overflow-hidden screen-enter">
            {renderAdmin(screen)}
          </div>
        </div>
      </AdminThemeProvider>
    );
  }

  return (
    <PhoneShell>
      <WebTopNav role={role} />
      <div
        key={displayScreen.name + ('id' in displayScreen ? (displayScreen as { id?: string }).id || '' : '')}
        className="screen-enter flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      >
        {role === 'customer' ? renderCustomer(displayScreen) : renderProvider(displayScreen)}
      </div>
      <BottomNav />
      <AssistantLauncher />
      {/* Silent GPS publisher so customers can track an in-progress job. */}
      {role === 'provider' && screen.name !== 'provider-auth' && <ProviderLocationPublisher />}
      {assistantOpen && <AssistantPanel />}
    </PhoneShell>
  );
}

function renderCustomer(screen: ReturnType<typeof useApp>['screen']) {
  switch (screen.name) {
    case 'splash': return <SplashScreen />;
    case 'auth': return <AuthScreen />;
    case 'home': return <HomeScreen />;
    case 'services': return <ServicesScreen />;
    case 'search': return <SearchScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'assistant': return <AssistantScreen />;
    case 'category': return <CategoryScreen slug={screen.slug} />;
    case 'service': return <ServiceDetailScreen id={screen.id} />;
    case 'professionals': return <ProfessionalListScreen slug={screen.slug} />;
    case 'professional': return <ProfessionalProfileScreen id={screen.id} />;
    case 'booking': return <BookingFlowScreen serviceId={screen.serviceId} professionalId={screen.professionalId} />;
    case 'payment': return <PaymentScreen bookingId={screen.bookingId} />;
    case 'booking-success': return <BookingSuccessScreen bookingId={screen.bookingId} />;
    case 'tracking': return <TrackingScreen bookingId={screen.bookingId} />;
    case 'invoice': return <InvoiceScreen bookingId={screen.bookingId} />;
    case 'bookings': return <MyBookingsScreen />;
    case 'reviews': return <ReviewScreen bookingId={screen.bookingId} />;
    case 'profile': return <ProfileScreen />;
    case 'help': return <HelpScreen />;
    case 'refunds': return <RefundsScreen />;
    case 'addresses': return <AddressesScreen detected={screen.detected} />;
    case 'favourites': return <FavouritesScreen />;
    default: return <HomeScreen />;
  }
}

function renderProvider(screen: ReturnType<typeof useApp>['screen']) {
  switch (screen.name) {
    case 'provider-auth': return <ProviderAuthScreen />;
    case 'provider-home': return <ProviderHomeScreen />;
    case 'provider-bookings': return <ProviderBookingsScreen />;
    case 'provider-earnings': return <ProviderEarningsScreen />;
    case 'provider-profile': return <ProviderProfileScreen />;
    case 'provider-detail': return <ProviderDetailScreen bookingId={screen.bookingId} />;
    // Shared with the customer app: the screen reads role from context, so it
    // shows this professional's bell, not a customer's.
    case 'notifications': return <NotificationsScreen />;
    case 'assistant': return <AssistantScreen />;
    case 'help': return <HelpScreen />;
    case 'invoice': return <InvoiceScreen bookingId={screen.bookingId} />;
    default: return <ProviderHomeScreen />;
  }
}

function renderAdmin(screen: ReturnType<typeof useApp>['screen']) {
  switch (screen.name) {
    case 'admin-auth': return <AdminLoginScreen />;
    case 'admin-dashboard': return <AdminDashboard />;
    case 'admin-customers': return <AdminCustomers />;
    case 'admin-providers': return <AdminProviders />;
    case 'admin-services': return <AdminServices />;
    case 'admin-bookings': return <AdminBookings />;
    case 'invoice': return <InvoiceScreen bookingId={screen.bookingId} />;
    case 'admin-profile': return <AdminProfile />;
    case 'admin-coupons': return <AdminCoupons />;
    case 'admin-payouts': return <AdminPayouts />;
    case 'admin-refunds': return <AdminRefunds />;
    case 'admin-disputes': return <AdminDisputes />;
    case 'admin-notifications': return <AdminNotifications />;
    default: return <AdminDashboard />;
  }
}

export default function App() {
  return (
    <CustomerThemeProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </CustomerThemeProvider>
  );
}
