const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: { type: String, required: true }, // Auth0 ID of the client
    roomId: { type: String, required: true },
    roomName: String, // Store snapshot of name in case it changes later
    date: { type: Date, required: true },

    // Financials
    basePrice: Number,
    weatherCharge: Number, // The extra fee added
    finalPrice: Number,

    // Status
    status: { 
        type: String, 
        enum: ['pending', 'confirmed', 'cancelled'], 
        default: 'pending' 
    },
    stripeSessionId: String // To match payment to booking
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);