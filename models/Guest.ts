import mongoose from 'mongoose';
import { Guest } from '@/app/types/guest';

const guestSchema = new mongoose.Schema<Guest>({
  id: { type: String, required: true }, // Remove global unique constraint
  userId: { type: String, required: true, index: true }, // Associate guest with user
  name: { type: String, required: true },
  phone: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'declined', 'not_sent'],
    default: 'not_sent'
  },
  mealPreference: { 
    type: String,
    enum: ['meat', 'vegetarian', 'vegan', 'kosher', 'other'],
    default: 'other'
  },
  numberOfAttendees: { type: Number, required: true, default: 1 },
  tableNumber: { type: Number },
  specialRequests: { type: String },
  dateResponded: { type: Date },
  dateInvited: { type: Date }
}, {
  timestamps: true
});

// Create user-specific indexes for data isolation
guestSchema.index({ userId: 1 });
guestSchema.index({ userId: 1, phone: 1 }, { unique: true });
guestSchema.index({ userId: 1, id: 1 }, { unique: true });

export default mongoose.models.Guest || mongoose.model('Guest', guestSchema);