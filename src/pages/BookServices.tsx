import { Button as DSButton } from "@/design-system";
import { Link } from "react-router-dom";
import { Search, Calendar, CreditCard, Video, MessageCircle, MapPin, Clock, Star } from "lucide-react";
import clientBookingFlow from "@/assets/client-booking-flow.jpg";
import browseServices from "@/assets/browse-services.jpg";
import easyBooking from "@/assets/easy-booking.jpg";
import payAndConnect from "@/assets/pay-and-connect.jpg";
import { H1, H2, H3 } from "@/design-system";

const BookServices = () => {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <H1 className="mb-4">
                Find the Perfect Expert
                <span className="text-primary block">For Any Task</span>
              </H1>
              <p className="text-lg text-muted-foreground mb-6 leading-snug max-w-lg">
                Browse thousands of professionals, book instantly, and pay securely. 
                Your payment is held safely until you confirm service completion - no scams, just quality service.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <DSButton as={Link} to="/discover" size="large" className="text-lg px-8">
                  Browse Experts
                </DSButton>
                <DSButton variant="secondary" size="large" as={Link} to="/auth" className="text-lg px-8">
                  Join as Provider
                </DSButton>
              </div>
            </div>
            <div className="relative">
              <img 
                src={clientBookingFlow} 
                alt="Customer booking flow showing how to find and book services"
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <H2 className="mb-4">How to Book Services</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to get expert help for any challenge
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={browseServices} 
                  alt="Browsing service provider profiles"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  1
                </div>
              </div>
              <H3 className="mb-4">Browse & Discover</H3>
              <p className="text-muted-foreground leading-relaxed">
                Search through verified professionals by skill, rating, and availability. 
                Read reviews and find the perfect match for your needs.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={easyBooking} 
                  alt="Booking calendar and time selection"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  2
                </div>
              </div>
              <H3 className="mb-4">Book Instantly</H3>
              <p className="text-muted-foreground leading-relaxed">
                Check their real-time availability and book a time slot that works for you. 
                Choose between video calls, chat, or in-person meetings.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={payAndConnect} 
                  alt="Payment and video connection"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  3
                </div>
              </div>
              <H3 className="mb-4">Pay Securely & Confirm</H3>
              <p className="text-muted-foreground leading-relaxed">
                Pay with your credit card - funds are held safely until you confirm the service was completed successfully. 
                This protects you from scams and ensures quality service.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Types Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <H2 className="mb-4">Choose Your Preferred Method</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect with experts in the way that works best for you
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">Video Calls</H3>
              <p className="text-muted-foreground">
                Face-to-face consultations, workshops, and training sessions from anywhere.
              </p>
            </div>

            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">Text Chat</H3>
              <p className="text-muted-foreground">
                Get advice and support through messaging. Perfect for quick questions and ongoing help.
              </p>
            </div>

            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">In Person</H3>
              <p className="text-muted-foreground">
                Meet experts locally for hands-on help, workshops, or personal sessions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <H2 className="mb-4">Why Book Through Timee?</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The most convenient way to access expert knowledge and services
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Verified Experts</H3>
              <p className="text-muted-foreground text-sm">
                All professionals are verified with reviews and ratings
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Instant Booking</H3>
              <p className="text-muted-foreground text-sm">
                Book available time slots immediately without waiting
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Secure Payments</H3>
              <p className="text-muted-foreground text-sm">
                Funds held safely until service completion - protected transactions
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Scam Protection</H3>
              <p className="text-muted-foreground text-sm">
                Funds released only after you confirm successful service completion
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <H2 className="mb-6">Ready to Get Expert Help?</H2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Browse thousands of professionals ready to help you achieve your goals. 
            Find the perfect expert and book your session today.
          </p>
          <Button asChild size="lg" className="text-lg px-12">
            <Link to="/profile">Start Browsing Experts</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default BookServices;