# Nook - Peer-to-Peer Booking Platform

A modern, responsive P2P booking platform where users can both offer their time slots and book from others.

## Features

- **Dual User Roles**: Each user can be both a service provider and a booker
- **Slot Management**: Create, edit, and manage your available time slots
- **Service Discovery**: Browse and search available services from other users
- **Flexible Booking**: Book time slots from other providers
- **User Profiles**: Complete user profiles with services offered
- **Real-time Availability**: Live slot availability and booking confirmation
- **Booking Management**: Track your bookings and slot reservations
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Modern CSS with Flexbox/Grid
- **Build Tools**: Node.js and npm for development
- **Storage**: Local storage for demo (can be upgraded to backend)

## Project Structure

```
nook/
├── index.html          # Main application page
├── css/
│   ├── style.css       # Main styles
│   └── responsive.css  # Mobile responsiveness
├── js/
│   ├── app.js          # Main application logic
│   ├── users.js        # User management system
│   ├── slots.js        # Slot creation and management
│   ├── booking.js      # P2P booking functionality
│   ├── calendar.js     # Calendar component
│   └── dashboard.js    # User dashboard
├── assets/
│   └── images/         # Project images
└── package.json        # Project configuration
```

## Getting Started

1. **Clone/Setup**: Ensure you're in the project directory
2. **Install Dependencies**: Run `npm install`
3. **Start Development**: Run `npm start`
4. **Open Browser**: Navigate to `http://localhost:3000`

## Usage

### As a Service Provider:
1. **Create Profile**: Set up your user profile with services offered
2. **Create Slots**: Define available time slots with pricing
3. **Manage Bookings**: View and manage incoming booking requests
4. **Update Availability**: Modify or delete your available slots

### As a Booker:
1. **Browse Services**: Discover available services from other users
2. **Search & Filter**: Find specific services or time slots
3. **Book Slots**: Request to book available time slots
4. **Manage Bookings**: Track your booking requests and confirmations

## Key Workflows

- **User Registration**: Simple profile creation with service offerings
- **Slot Creation**: Easy interface to create recurring or one-time slots
- **Service Discovery**: Browse, search, and filter available services
- **Booking Flow**: Request slots → Provider approval → Confirmation
- **Dashboard**: Unified view of your slots offered and bookings made

## Development

- **Development Server**: `npm run dev`
- **Build Production**: `npm run build`
- **Run Tests**: `npm test`

## Data Models

- **Users**: Profile, contact info, services offered, ratings
- **Slots**: Time, duration, price, description, provider, availability
- **Bookings**: Slot reference, booker, status, timestamps

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use for personal or commercial projects.