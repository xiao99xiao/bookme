/**
 * English Locale
 *
 * Terminology Reference (Three-Layer Object Model):
 * - Talk = Service definition/template (what can be booked)
 * - Slot = Specific available time (from Availability)
 * - Booking = Result object (Talk + Slot + Visitor combination)
 *
 * Roles:
 * - Host = Provider/seller who offers Talks
 * - Visitor = Customer/buyer who books Talks
 *
 * Spaces:
 * - Nook = Host's profile page/space
 * - Note = Review/feedback from Visitor
 */

export const en = {
  // ===========================================
  // Common / Shared
  // ===========================================
  common: {
    appName: 'Nook',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    update: 'Update',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    skip: 'Skip',
    close: 'Close',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    all: 'All',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    or: 'or',
    and: 'and',
    optional: 'Optional',
    required: 'Required',
    sending: 'Sending...',
  },

  // ===========================================
  // Roles
  // ===========================================
  roles: {
    host: 'Host',
    visitor: 'Visitor',
    hostMode: 'Host mode',
    visitorMode: 'Visitor mode',
  },

  // ===========================================
  // Objects (Talk, Booking, Note, Nook)
  // ===========================================
  talk: {
    singular: 'Talk',
    plural: 'Talks',
    title: 'Talk Title',
    description: 'Description',
    duration: 'Duration',
    price: 'Price',
    location: 'Location',

    // Actions
    create: 'Create a Talk',
    createNew: 'Create New Talk',
    edit: 'Edit Talk',
    delete: 'Delete Talk',
    publish: 'Publish Talk',
    pause: 'Pause Talk',
    update: 'Update Talk',

    // States
    published: 'published',
    paused: 'paused',
    visible: 'visible',
    hidden: 'hidden',

    // Messages
    noTalks: 'No Talks yet',
    createFirst: 'Create your first Talk to start accepting bookings',
    noTalksToPreview: 'No Talks to preview',
    createFirstPreview: 'Create your first Talk to see how it will appear to visitors',

    // Tips
    tips: {
      title: 'Tips for Great Talks',
      clearTitles: 'Use clear, descriptive titles that visitors can easily understand',
      competitivePrices: 'Set competitive prices based on your expertise and market rates',
      detailedDescription: 'Include all important details in your Talk description',
      keepVisible: 'Keep Talks visible to appear in search results',
    },
  },

  booking: {
    singular: 'Booking',
    plural: 'Bookings',
    myBookings: 'My Bookings',

    // Statuses
    status: {
      pending: 'Pending',
      pendingPayment: 'Payment Required',
      paid: 'Paid',
      confirmed: 'Confirmed',
      inProgress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      rejected: 'Rejected',
    },

    // Status descriptions
    statusDescription: {
      pending: 'Awaiting Confirmation',
      pendingPayment: 'Payment Required',
      paid: "Pending Host's Confirmation",
      confirmed: 'Upcoming',
      inProgress: 'In Progress',
      rejected: 'Rejected by Host',
    },

    // Actions
    book: 'Book Talk',
    cancel: 'Cancel Booking',
    cancelRequest: 'Cancel Request',
    reschedule: 'Reschedule Booking',
    complete: 'Mark Complete',
    payNow: 'Pay Now',

    // Labels
    bookedOn: 'Booked {{date}}',
    withHost: 'Your bookings with hosts',
    upcoming: 'Upcoming',
    past: 'Past',

    // Auto-completion
    autoComplete: 'Will auto-complete {{datetime}}',
    manualCompletionRequired: 'Manual Completion Required',
    manualCompletionDescription: "The host's session time was shorter than expected. Please confirm if you received satisfactory service.",
    markCompleteAndRelease: 'Mark as Complete & Release Payment',
  },

  note: {
    singular: 'Note',
    plural: 'Notes',
    visitorNote: 'Visitor Note',
    yourNote: 'Your note',
    leaveNote: 'Leave a Note',
    updateNote: 'Update your note',
    editNote: 'Edit Note',
    viewNote: 'View Note',
    submitNote: 'Leave Note',

    // Rating
    rating: 'Rating',
    yourRating: 'Your rating',
    visitorRating: 'Visitor rating',
    rateExperience: 'Rate your experience',
    shareExperience: 'Share your experience (optional)',
    shareExperienceBooking: 'Share your experience with this booking',
    visitorComments: 'Visitor comments',
    yourComments: 'Your comments',

    // Rating labels
    ratingLabels: {
      poor: 'Poor',
      fair: 'Fair',
      good: 'Good',
      veryGood: 'Very Good',
      excellent: 'Excellent',
    },

    // Messages
    editWindow: 'Notes can only be edited within 7 days of booking completion. You can view your note below.',
    noComments: 'No comments provided',
    placeholder: 'Tell us about your experience...',
  },

  nook: {
    singular: 'Nook',
    plural: 'Nooks',
    myNook: 'My Nook',
    createNook: 'Create your Nook',
    exploreNooks: 'Explore Nooks',
  },

  // ===========================================
  // Reschedule
  // ===========================================
  reschedule: {
    // Titles
    requestTitle: 'Request Time Change',
    pendingRequest: 'Reschedule Pending',
    proposeNewTime: 'Propose New Time',
    proposeTimeChange: 'Propose Time Change',

    // Form labels
    reason: 'Reason (optional)',
    reasonPlaceholder: 'Why do you need to reschedule?',
    currentTime: 'Current Time',
    proposedTime: 'Proposed Time',
    selectNewDate: 'Select new date',
    selectNewTime: 'Select new time',
    availableTimes: 'Available times',

    // Status display
    expiresIn: 'Expires in {{time}}',
    waitingForResponse: 'Waiting for response...',
    requestedBy: '{{name}} requested to change time',
    youRequested: 'You requested to change time',

    // Actions
    accept: 'Accept New Time',
    reject: 'Decline',
    withdraw: 'Withdraw Request',
    sendRequest: 'Send Request',
    sendProposal: 'Send Proposal',
    requestChange: 'Request Change',
    proposeChange: 'Propose Change',

    // Visitor limits
    remainingReschedules: '{{count}} reschedule remaining',
    noReschedulesLeft: 'No reschedules remaining',
    oneRescheduleWarning: 'You can only reschedule once per booking.',
    usedReschedule: "You've used your reschedule for this booking",

    // Host messages
    hostUnlimitedReschedules: 'Hosts can request reschedules at any time',
    makeAvailable: 'Make sure you\'re available at this time!',
    visitorWillBeNotified: '{{name}} will be notified and can accept or decline.',
    // Better named alternative for the notification message
    otherPartyWillBeNotified: '{{name}} will be notified and can accept or decline.',

    // Time comparison
    changeTo: 'Change to',
    newTime: 'New Time',

    // Status messages
    requestSent: 'Reschedule request sent',
    requestApproved: 'Reschedule approved! Time updated.',
    requestRejected: 'Reschedule request declined',
    requestExpired: 'Reschedule request expired',
    requestWithdrawn: 'Reschedule request withdrawn',
    timeUpdated: 'Booking time updated!',

    // History
    rescheduledFrom: 'Rescheduled from {{time}}',
    originalTime: 'Original time',

    // Errors
    cannotReschedule: 'Cannot reschedule this booking',
    tooCloseToStart: 'Too close to booking start time',
    timeNotAvailable: 'Selected time is not available',
    pendingRequestExists: 'A reschedule request is already pending',
    alreadyEnded: 'Cannot reschedule after booking has ended',
    requestExpiredError: 'This request has expired',

    // Confirmation dialogs
    acceptConfirmTitle: 'Accept Time Change?',
    acceptConfirmDescription: 'The booking will be moved to the new time.',
    rejectConfirmTitle: 'Decline Request?',
    rejectConfirmDescription: 'The booking will remain at the original time.',
    rejectReason: 'Reason (optional)',
    rejectReasonPlaceholder: 'Let them know why you\'re declining...',
  },

  // ===========================================
  // Pages
  // ===========================================
  pages: {
    discover: {
      title: 'Discover Talks',
      subtitle: 'Browse hosts offering Talks on topics you care about',
      loading: 'Loading Talks...',
      noResults: 'No Talks found matching your criteria.',
      showingCount: 'Showing {{count}} Talk',
      showingCountPlural: 'Showing {{count}} Talks',
      wantToOffer: 'Want to Offer Talks?',
      joinHosts: 'Join hosts earning by sharing Talks on topics they love',
    },

    earnings: {
      title: 'Earnings',
      hostEarnings: 'Host earnings',
      referralBonus: 'Referral bonus',
      referralFee: 'Referral Fee',
    },

    messages: {
      title: 'Messages',
      chatWithHosts: 'Chat with hosts',
      chatWithVisitors: 'Chat with visitors',
      chatWithAll: 'Chat with visitors and hosts',
    },

    settings: {
      title: 'Settings',
      profile: 'Profile',
      integrations: 'Integrations',
      balance: 'Balance',
      referrals: 'Referrals',
    },

    onboarding: {
      letsGetToKnow: "Let's get to know you!",
      nameHelps: 'Your name helps others identify you when booking Talks or viewing your Nook.',
      whereLocated: 'Where are you located?',
      locationHelps: 'This helps match you with nearby Talks and lets others know your general area when you offer Talks.',
      tellAboutYourself: 'Tell us about yourself',
      bioHelps: "A brief bio helps others understand who you are and what you're passionate about. This appears on your Nook.",
      readyToBecomeHost: 'Ready to become a Host?',
      earnByOffering: '{{appName}} lets you earn by offering Talks and sharing your knowledge with others. You can always change this later.',
      yesBecome: 'Yes, I want to become a Host',
      createNookStart: 'Create your Nook and start offering Talks to others',
      notRightNow: 'Not right now',
      justBrowse: 'I just want to browse and book Talks from hosts',
      referredBy: "You've been referred by {{name}}",
      referredByHost: "You've been referred by another host",
    },
  },

  // ===========================================
  // Actions & Buttons
  // ===========================================
  actions: {
    becomeHost: 'Become a Host',
    switchToHost: 'Switch to Host Mode',
    switchToVisitor: 'Switch to Visitor Mode',
    getStarted: 'Get Started',
    logOut: 'Log out',
    copyLink: 'Copy Link',
    join: 'Join',
    startEarning: 'Start earning by offering Talks',
  },

  // ===========================================
  // Toast Messages
  // ===========================================
  toast: {
    success: {
      bookingCompleted: 'Booking completed successfully! Funds have been distributed.',
      bookingCompletedManually: 'Booking completed manually! Funds will be distributed.',
      bookingCancelled: 'Booking cancelled successfully',
      paymentSuccessful: 'Payment successful! Booking confirmed.',
      noteUpdated: 'Note updated successfully!',
      noteSubmitted: 'Thank you for your note!',
      talkCreated: 'Talk created successfully',
      talkUpdated: 'Talk updated successfully',
      talkDeleted: 'Talk deleted successfully',
      talkPublished: 'Talk published',
      talkPaused: 'Talk paused',
      linkCopied: 'Meeting link copied to clipboard',
      welcomeHost: 'Welcome to host mode! You can now create Talks.',
      switchedToHost: 'Switched to Host mode',
      switchedToVisitor: 'Switched to Visitor mode',
      // Reschedule
      rescheduleRequestSent: 'Reschedule request sent!',
      rescheduleApproved: 'Time change approved! Booking updated.',
      rescheduleRejected: 'Reschedule request declined',
      rescheduleWithdrawn: 'Reschedule request withdrawn',
    },
    error: {
      bookingCompletionFailed: 'Booking completion failed: {{error}}',
      failedToCompleteBooking: 'Failed to complete booking',
      failedToCancelBooking: 'Failed to cancel booking',
      paymentFailed: 'Payment failed: {{error}}',
      failedToSubmitNote: 'Failed to submit note. Please try again.',
      failedToUpdateNote: 'Failed to update note. Please try again.',
      failedToLoadBookings: 'Failed to load bookings',
      failedToLoadTalks: 'Failed to load Talks. Please try again.',
      failedToSaveTalk: 'Failed to save Talk',
      failedToDeleteTalk: 'Failed to delete Talk',
      failedToUpdateVisibility: 'Failed to update Talk visibility',
      connectWallet: 'Please connect your wallet to complete this booking',
      bookingNotFound: 'Booking not found',
      bookingNotBlockchain: 'This booking was not paid via blockchain and cannot be completed this way',
      noMeetingLink: 'No meeting link available',
      noPublicProfile: 'This host does not have a public profile',
      failedToBecomeHost: 'Failed to enable host mode. Please try again.',
      integrationRequired: 'You need to connect {{platform}} in your Integrations before creating this Talk.',
      // Reschedule
      failedToCreateRescheduleRequest: 'Failed to send reschedule request',
      failedToRespondReschedule: 'Failed to respond to reschedule request',
      failedToWithdrawReschedule: 'Failed to withdraw reschedule request',
      rescheduleNotAllowed: 'You cannot reschedule this booking',
      rescheduleTimeConflict: 'The proposed time is no longer available',
    },
  },

  // ===========================================
  // Validation Messages
  // ===========================================
  validation: {
    selectRating: 'Please select a rating',
    selectTimeSlot: 'Please select at least one time slot',
    titleMinLength: 'Title must be at least 5 characters',
    descriptionMinLength: 'Description must be at least 20 characters',
  },

  // ===========================================
  // Meeting / Session
  // ===========================================
  meeting: {
    online: 'Online',
    inPerson: 'In-Person',
    phone: 'Phone',
    joinMeeting: 'Join Meeting',
    copyMeetingLink: 'Copy Meeting Link',
    googleCalendar: 'Google Calendar',
    downloadIcs: 'Download .ics file',
    platform: {
      googleMeet: 'Google Meet',
      zoom: 'Zoom',
      teams: 'Microsoft Teams',
    },
  },

  // ===========================================
  // Time & Duration
  // ===========================================
  time: {
    minutes: '{{count}} minutes',
    hours: '{{count}} hour',
    hoursPlural: '{{count}} hours',
    duration: 'Duration',
    sessionDuration: 'Session Duration',
  },

  // ===========================================
  // Currency & Payment
  // ===========================================
  payment: {
    total: 'Total',
    pay: 'Pay',
    paid: 'Paid',
    pricePerSession: 'Price per Session',
    processing: 'Processing...',
    usdc: 'USDC',
  },

  // ===========================================
  // Empty States
  // ===========================================
  empty: {
    noBookingsYet: 'No bookings yet',
    browseServices: 'Browse Talks',
  },

  // ===========================================
  // Confirmation Dialogs
  // ===========================================
  confirm: {
    deleteTalk: 'Delete Talk',
    deleteTalkDescription: 'Are you sure you want to delete "{{title}}"? This action cannot be undone.',
  },
} as const;
