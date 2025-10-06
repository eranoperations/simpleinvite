import mongoose from 'mongoose';
import { Guest, GuestStatus, MealPreference } from '@/app/types/guest';

const guestSchema = new mongoose.Schema<Guest>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'declined', 'not_sent'],
    default: 'not_sent'
  },
  mealPreference: { 
    type: String,
    enum: ['meat', 'vegetarian', 'vegan', 'kosher', 'other'],
    default: 'meat'
  },
  numberOfAttendees: { type: Number, required: true, default: 1 },
  tableNumber: { type: Number },
  specialRequests: { type: String },
  dateResponded: { type: Date },
  dateInvited: { type: Date }
}, {
  timestamps: true
});

export default mongoose.models.Guest || mongoose.model('Guest', guestSchema);