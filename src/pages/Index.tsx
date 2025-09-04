import { Button as DSButton } from "@/design-system";
import { Link } from "react-router-dom";
import { Clock, CreditCard, User, Globe, Coins, Video, MessageCircle, MapPin } from "lucide-react";
import heroIllustration from "@/assets/hero-illustration.jpg";
import createProfileImg from "@/assets/create-profile.jpg";
import bookServiceImg from "@/assets/book-service.jpg";
import cryptoPaymentImg from "@/assets/crypto-payment.jpg";
import { H1, H2, H3 } from "@/design-system";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-left">
              <H1 className="mb-4">
                Your Expertise Matters,
                <span className="text-primary block">Share It</span>
              </H1>
              <p className="text-lg text-muted-foreground mb-6 leading-snug max-w-lg">
                Turn your expertise into income. Share what you know, set your schedule, and get paid in crypto while customers use their credit cards.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <DSButton as={Link} to="/auth" size="large" className="text-lg px-8">
                  Start Earning Today
                </DSButton>
                <DSButton variant="secondary" size="large" as={Link} to="/book-services" className="text-lg px-8">
                  I'm Looking for Services
                </DSButton>
              </div>
            </div>
            <div className="relative">
              <img 
                src={heroIllustration} 
                alt="People offering various services through digital platform"
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
            <H2 className="mb-4">How It Works</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Three simple steps to start monetizing your expertise and time
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={createProfileImg} 
                  alt="Creating a professional profile"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  1
                </div>
              </div>
              <H3 className="mb-4">Create Your Profile</H3>
              <p className="text-muted-foreground leading-relaxed">
                Set up your professional profile with your skills, experience, and availability. 
                Define your services and hourly rates.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={bookServiceImg} 
                  alt="Customers booking appointments"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  2
                </div>
              </div>
              <H3 className="mb-4">Share & Get Booked</H3>
              <p className="text-muted-foreground leading-relaxed">
                Share your profile link anywhere. Customers can easily browse your services 
                and book time slots that work for both of you.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mb-8">
                <img 
                  src={cryptoPaymentImg} 
                  alt="Crypto payment processing"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                  3
                </div>
              </div>
              <H3 className="mb-4">Get Paid Securely</H3>
              <p className="text-muted-foreground leading-relaxed">
                Customers pay upfront, but funds are held safely until they confirm successful service completion. 
                This protects everyone and ensures you get paid for quality work.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Delivery Methods Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <H2 className="mb-4">Deliver Your Services Your Way</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose how you want to connect with your customers. Flexibility is key to growing your business.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">Online Meetings</H3>
              <p className="text-muted-foreground">
                Host video calls, workshops, consultations, or training sessions from anywhere in the world.
              </p>
            </div>

            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">Text Chat</H3>
              <p className="text-muted-foreground">
                Provide advice, coaching, or support through messaging. Perfect for ongoing mentorship.
              </p>
            </div>

            <div className="text-center p-8 bg-background rounded-lg border">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-3">In Person</H3>
              <p className="text-muted-foreground">
                Meet customers locally for hands-on services, workshops, or personal consultations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <H2 className="mb-4">Why Choose Our Platform?</H2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for the global freelance economy with crypto-first payments
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Global Reach</H3>
              <p className="text-muted-foreground text-sm">
                Work with customers worldwide without payment barriers
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Coins className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Secure Payments</H3>
              <p className="text-muted-foreground text-sm">
                Funds are held safely until service completion, protecting both parties
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Time Management</H3>
              <p className="text-muted-foreground text-sm">
                Set your availability and let customers book when convenient
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <H3 className="mb-2">Protected Payments</H3>
              <p className="text-muted-foreground text-sm">
                Customers pay easily, funds held securely until service completion
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <H2 className="mb-6">Ready to Monetize Your Time?</H2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of professionals already earning cryptocurrency by sharing their expertise.
            Start building your income stream today.
          </p>
          <DSButton as={Link} to="/auth" size="large" className="text-lg px-12">
            Create Your Profile Now
          </DSButton>
        </div>
      </section>
    </div>
  );
};

export default Index;
