import mongoose from 'mongoose';

interface UserSettings {
  userId: string;
  appName: string;
  eventName?: string;
  eventDate?: Date;
  defaultMealPreference: 'meat' | 'vegetarian' | 'vegan' | 'kosher' | 'other';
  maxGuestsPerInvite: number;
  emailTemplates?: {
    invitation?: string;
    reminder?: string;
    confirmation?: string;
  };
  customFields?: Array<{
    name: string;
    type: 'text' | 'number' | 'select' | 'checkbox';
    required: boolean;
    options?: string[];
  }>;
}

const userSettingsSchema = new mongoose.Schema<UserSettings>({
  userId: { type: String, required: true, unique: true, index: true },
  appName: { type: String, default: 'SimpleInvite' },
  eventName: { type: String },
  eventDate: { type: Date },
  defaultMealPreference: { 
    type: String,
    enum: ['meat', 'vegetarian', 'vegan', 'kosher', 'other'],
    default: 'other'
  },
  maxGuestsPerInvite: { type: Number, default: 10 },
  emailTemplates: {
    invitation: { type: String },
    reminder: { type: String },
    confirmation: { type: String }
  },
  customFields: [{
    name: { type: String, required: true },
    type: { 
      type: String, 
      enum: ['text', 'number', 'select', 'checkbox'],
      required: true 
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }]
  }]
}, {
  timestamps: true
});

export default mongoose.models.UserSettings || mongoose.model('UserSettings', userSettingsSchema);