/**
 * HomePage - Landing page with public profile style
 *
 * Uses the same CSS variable system as PublicProfile for visual consistency.
 * Content focuses on platform features, registration CTAs, and contact info.
 */

import { Link } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/contexts/PrivyAuthContext';
import {
  Star,
  Shield,
  Clock,
  Users,
  Wallet,
  Calendar,
  ArrowRight,
  Twitter,
  Mail,
} from 'lucide-react';

// Theme system imports - use default theme for landing
import {
  getTheme,
  themeToCSSVars,
  THEME_CLASS_PREFIX,
} from '@/lib/themes';

// Import shared styles
import '../public-profile/styles/public-profile.css';
import './styles/home.css';

// =====================================================
// Component
// =====================================================

const HomePage = () => {
  const { login } = usePrivy();
  const { isAuthenticated } = useAuth();

  // Use default theme for landing page
  const theme = getTheme('default');

  const handleProviderSignup = () => {
    // Store intent to become provider, then login
    sessionStorage.setItem('signup_intent', 'provider');
    login();
  };

  const handleCustomerSignup = () => {
    sessionStorage.setItem('signup_intent', 'customer');
    login();
  };

  const handleLogin = () => {
    login();
  };

  return (
    <div
      className={`${THEME_CLASS_PREFIX}-container home-page`}
      style={themeToCSSVars(theme)}
    >
      <div className={`${THEME_CLASS_PREFIX}-layout`}>
        <div className={`${THEME_CLASS_PREFIX}-main`}>
          <div className={`${THEME_CLASS_PREFIX}-content home-content`}>
            {/* Header / Hero */}
            <div className={`${THEME_CLASS_PREFIX}-header home-hero`}>
              <div className="home-logo">
                <div className="home-logo-icon">B</div>
              </div>
              <div className={`${THEME_CLASS_PREFIX}-header-info`}>
                <h1 className={`${THEME_CLASS_PREFIX}-name home-title`}>
                  BookMe
                </h1>
                <div className={`${THEME_CLASS_PREFIX}-badges`}>
                  <span className={`${THEME_CLASS_PREFIX}-badge`}>
                    <Shield className={`${THEME_CLASS_PREFIX}-badge-icon`} />
                    Secure Payments
                  </span>
                  <span className={`${THEME_CLASS_PREFIX}-badge`}>
                    <Star className={`${THEME_CLASS_PREFIX}-badge-icon`} style={{ fill: 'currentColor' }} />
                    Trusted Platform
                  </span>
                </div>
              </div>
            </div>

            {/* Bio / Introduction */}
            <div className={`${THEME_CLASS_PREFIX}-bio home-intro`}>
              <p>
                BookMe is a peer-to-peer booking platform where you can offer your services
                or book time with skilled professionals. Get paid securely with blockchain-powered
                escrow payments.
              </p>
            </div>

            <div className={`${THEME_CLASS_PREFIX}-divider`} />

            {/* Features Section */}
            <h2 className={`${THEME_CLASS_PREFIX}-section-title`}>Why BookMe?</h2>
            <div className="home-features">
              <FeatureCard
                icon={<Shield />}
                title="Guaranteed Payments"
                description="Smart contract escrow ensures you always get paid for completed services."
              />
              <FeatureCard
                icon={<Wallet />}
                title="USDC Payments"
                description="Receive payments in stable cryptocurrency with instant settlement."
              />
              <FeatureCard
                icon={<Calendar />}
                title="Easy Scheduling"
                description="Sync with Google Calendar and manage your availability effortlessly."
              />
              <FeatureCard
                icon={<Clock />}
                title="Flexible Services"
                description="Offer online video calls, phone consultations, or in-person meetings."
              />
              <FeatureCard
                icon={<Star />}
                title="Build Reputation"
                description="Collect reviews and ratings to attract more customers."
              />
              <FeatureCard
                icon={<Users />}
                title="Referral Rewards"
                description="Earn 5% from every invite's income without affecting their payout."
              />
            </div>

            <div className={`${THEME_CLASS_PREFIX}-divider`} />

            {/* Services / CTAs Section */}
            <h2 className={`${THEME_CLASS_PREFIX}-section-title`}>Get Started</h2>
            <div className={`${THEME_CLASS_PREFIX}-services`}>
              {/* Provider Registration */}
              <div
                className={`${THEME_CLASS_PREFIX}-service-card home-cta-card`}
                onClick={isAuthenticated ? undefined : handleProviderSignup}
                style={{ cursor: isAuthenticated ? 'default' : 'pointer' }}
              >
                <div className={`${THEME_CLASS_PREFIX}-service-header`}>
                  <div>
                    <h3 className={`${THEME_CLASS_PREFIX}-service-title`}>
                      Become a Provider
                    </h3>
                    <p className={`${THEME_CLASS_PREFIX}-service-description`}>
                      Share your skills and start earning. Set your own prices, schedule, and services.
                    </p>
                  </div>
                </div>
                <div className={`${THEME_CLASS_PREFIX}-service-meta`}>
                  <span className={`${THEME_CLASS_PREFIX}-service-price home-cta-label`}>
                    Start Earning
                  </span>
                  <span className={`${THEME_CLASS_PREFIX}-service-location-badge home-cta-badge`}>
                    <ArrowRight style={{ width: 14, height: 14 }} />
                    {isAuthenticated ? 'Go to Dashboard' : 'Sign Up Free'}
                  </span>
                </div>
              </div>

              {/* Customer Registration */}
              <div
                className={`${THEME_CLASS_PREFIX}-service-card home-cta-card`}
                onClick={isAuthenticated ? undefined : handleCustomerSignup}
                style={{ cursor: isAuthenticated ? 'default' : 'pointer' }}
              >
                <div className={`${THEME_CLASS_PREFIX}-service-header`}>
                  <div>
                    <h3 className={`${THEME_CLASS_PREFIX}-service-title`}>
                      Book Services
                    </h3>
                    <p className={`${THEME_CLASS_PREFIX}-service-description`}>
                      Find skilled professionals for tutoring, consulting, coaching, and more.
                    </p>
                  </div>
                </div>
                <div className={`${THEME_CLASS_PREFIX}-service-meta`}>
                  <span className={`${THEME_CLASS_PREFIX}-service-price home-cta-label`}>
                    Find Services
                  </span>
                  <span className={`${THEME_CLASS_PREFIX}-service-location-badge home-cta-badge`}>
                    <ArrowRight style={{ width: 14, height: 14 }} />
                    {isAuthenticated ? 'Browse Services' : 'Sign Up Free'}
                  </span>
                </div>
              </div>

              {/* Login */}
              {!isAuthenticated && (
                <div
                  className={`${THEME_CLASS_PREFIX}-service-card home-cta-card home-login-card`}
                  onClick={handleLogin}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={`${THEME_CLASS_PREFIX}-service-header`}>
                    <div>
                      <h3 className={`${THEME_CLASS_PREFIX}-service-title`}>
                        Already have an account?
                      </h3>
                      <p className={`${THEME_CLASS_PREFIX}-service-description`}>
                        Sign in to access your dashboard, manage bookings, and more.
                      </p>
                    </div>
                  </div>
                  <div className={`${THEME_CLASS_PREFIX}-service-meta`}>
                    <span className={`${THEME_CLASS_PREFIX}-service-price home-cta-label`}>
                      Welcome Back
                    </span>
                    <span className={`${THEME_CLASS_PREFIX}-service-location-badge home-cta-badge`}>
                      <ArrowRight style={{ width: 14, height: 14 }} />
                      Log In
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className={`${THEME_CLASS_PREFIX}-divider`} />

            {/* Contact Section */}
            <h2 className={`${THEME_CLASS_PREFIX}-section-title`}>Contact Us</h2>
            <div className="home-contact">
              <a
                href="https://twitter.com/bookme_app"
                target="_blank"
                rel="noopener noreferrer"
                className="home-contact-link"
              >
                <div className="home-contact-icon">
                  <Twitter />
                </div>
                <div className="home-contact-info">
                  <span className="home-contact-label">Twitter</span>
                  <span className="home-contact-value">@bookme_app</span>
                </div>
              </a>
              <a
                href="mailto:support@bookme.app"
                className="home-contact-link"
              >
                <div className="home-contact-icon">
                  <Mail />
                </div>
                <div className="home-contact-info">
                  <span className="home-contact-label">Email</span>
                  <span className="home-contact-value">support@bookme.app</span>
                </div>
              </a>
            </div>

            {/* Footer */}
            <div className="home-footer">
              <p>&copy; 2025 BookMe. All rights reserved.</p>
              <div className="home-footer-links">
                <Link to="/terms">Terms of Service</Link>
                <Link to="/privacy">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// Sub-components
// =====================================================

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="home-feature-card">
    <div className="home-feature-icon">{icon}</div>
    <div className="home-feature-content">
      <h3 className="home-feature-title">{title}</h3>
      <p className="home-feature-description">{description}</p>
    </div>
  </div>
);

export default HomePage;
