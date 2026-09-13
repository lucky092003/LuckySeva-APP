import { AppProvider, useApp } from '@/lib/app-context';
import { PhoneShell } from '@/components/PhoneShell';
import { BottomNav } from '@/components/BottomNav';
import { WebTopNav } from '@/components/WebTopNav';
import { AdminSidebar } from '@/screens/admin/AdminSidebar';

import { SplashScreen } from '@/screens/customer/SplashScreen';
import { AuthScreen } from '@/screens/customer/AuthScreen';
import { HomeScreen } from '@/screens/customer/HomeScreen';
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
import { MyBookingsScreen } from '@/screens/customer/MyBookingsScreen';
import { ReviewScreen } from '@/screens/customer/ReviewScreen';
import { ProfileScreen } from '@/screens/customer/ProfileScreen';
import { HelpScreen } from '@/screens/customer/HelpScreen';
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
} from '@/screens/admin/AdminScreens';

function Router() {
  const { screen, role, adminAuthed } = useApp();

  if (role === 'admin') {
    if (!adminAuthed) {
      return (
        <div className="min-h-screen bg-gray-100">
          <AdminLoginScreen />
        </div>
      );
    }

    return (
      <div className="flex h-screen min-h-screen overflow-hidden bg-gray-50">
        <AdminSidebar />
        <div key={screen.name} className="flex flex-1 flex-col overflow-hidden screen-enter">
          {renderAdmin(screen)}
        </div>
      </div>
    );
  }

  return (
    <PhoneShell>
      <WebTopNav role={role} />
      <div key={screen.name + ('id' in screen ? (screen as { id?: string }).id || '' : '')} className="flex flex-1 flex-col overflow-hidden screen-enter">
        {role === 'customer' ? renderCustomer(screen) : renderProvider(screen)}
      </div>
      <BottomNav />
    </PhoneShell>
  );
}

function renderCustomer(screen: ReturnType<typeof useApp>['screen']) {
  switch (screen.name) {
    case 'splash': return <SplashScreen />;
    case 'auth': return <AuthScreen />;
    case 'home': return <HomeScreen />;
    case 'search': return <SearchScreen />;
    case 'notifications': return <NotificationsScreen />;
    case 'category': return <CategoryScreen slug={screen.slug} />;
    case 'service': return <ServiceDetailScreen id={screen.id} />;
    case 'professionals': return <ProfessionalListScreen slug={screen.slug} />;
    case 'professional': return <ProfessionalProfileScreen id={screen.id} />;
    case 'booking': return <BookingFlowScreen serviceId={screen.serviceId} professionalId={screen.professionalId} />;
    case 'payment': return <PaymentScreen bookingId={screen.bookingId} />;
    case 'booking-success': return <BookingSuccessScreen bookingId={screen.bookingId} />;
    case 'tracking': return <TrackingScreen bookingId={screen.bookingId} />;
    case 'bookings': return <MyBookingsScreen />;
    case 'reviews': return <ReviewScreen bookingId={screen.bookingId} />;
    case 'profile': return <ProfileScreen />;
    case 'help': return <HelpScreen />;
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
    case 'admin-profile': return <AdminProfile />;
    default: return <AdminDashboard />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
