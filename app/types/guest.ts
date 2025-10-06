export type GuestStatus = 'pending' | 'confirmed' | 'declined' | 'not_sent';

export type MealPreference = 'meat' | 'vegetarian' | 'vegan' | 'kosher' | 'other';

export interface Guest {
    id: string;
    name: string;
    phone: string; // Making phone required
    status: GuestStatus;
    mealPreference: MealPreference;
    numberOfAttendees: number;
    tableNumber?: number;
    specialRequests?: string;
    dateResponded?: Date;
    dateInvited?: Date;
}