export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  sort_order: number;
};

export type Service = {
  id: string;
  category_id: string;
  name: string;
  description: string;
  starting_price: number;
  estimated_duration: string;
  popular: boolean;
};

export type Professional = {
  id: string;
  name: string;
  category_slug: string;
  skills: string[];
  experience_years: number;
  rating: number;
  reviews_count: number;
  completed_jobs: number;
  starting_price: number;
  avatar_url: string;
  distance_km: number;
  status: 'available' | 'busy';
  bio: string;
  service_area: string;
};

export type Review = {
  id: string;
  professional_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type BookingStatus =
  | 'confirmed'
  | 'assigned'
  | 'on_the_way'
  | 'started'
  | 'completed'
  | 'cancelled';

export type Booking = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  service_id: string | null;
  service_name: string;
  professional_id: string | null;
  professional_name: string;
  scheduled_date: string;
  scheduled_time: string;
  notes: string;
  base_price: number;
  visit_fee: number;
  total_amount: number;
  payment_method: string;
  status: BookingStatus;
  created_at: string;
};
