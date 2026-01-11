/**
 * Host Onboarding Templates
 *
 * Pre-defined templates for new hosts to quickly set up their profile.
 * Each template includes sample bio, profile buttons, and a starter Talk.
 */

import type { ThemeConfig } from './themes/types';

/**
 * Template Talk (Service) configuration
 */
export interface TemplateTalk {
  title: string;
  description: string;
  duration: number; // in minutes
  price: number; // in USD
  location: 'online' | 'phone' | 'in-person';
  meeting_platform?: 'google_meet' | 'zoom' | 'teams';
}

/**
 * Template Profile Button configuration
 */
export interface TemplateButton {
  label: string;
  url: string; // Use placeholders like {username}
  icon: string;
}

/**
 * Complete template configuration
 */
export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;

  // Profile content
  bio: string;

  // Suggested theme
  themeId: string;

  // Starter buttons (up to 4)
  buttons: TemplateButton[];

  // Starter talk
  talk: TemplateTalk;

  // Preview image or gradient
  previewGradient: string;
}

/**
 * Available onboarding templates
 */
export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'creator',
    name: 'Content Creator',
    description: 'Perfect for YouTubers, streamers, and social media influencers',
    emoji: '🎬',
    bio: `Hey! I create content that helps people learn and grow.

Book a 1-on-1 session with me to get personalized advice, collaborate on projects, or just have a great conversation.

Looking forward to connecting with you!`,
    themeId: 'vibrant',
    buttons: [
      { label: 'Twitter', url: 'https://twitter.com/{username}', icon: 'twitter' },
      { label: 'YouTube', url: 'https://youtube.com/@{username}', icon: 'youtube' },
      { label: 'Instagram', url: 'https://instagram.com/{username}', icon: 'instagram' },
    ],
    talk: {
      title: '1-on-1 Video Chat',
      description: `Let's have a personal conversation! Whether you want to ask questions, get advice, or just hang out - I'm here for you.

What we can discuss:
- Content creation tips and strategies
- Growing your audience
- Collaboration opportunities
- Q&A about anything

Book a slot and let's chat!`,
      duration: 30,
      price: 50,
      location: 'online',
      meeting_platform: 'google_meet',
    },
    previewGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'consultant',
    name: 'Consultant / Coach',
    description: 'For business consultants, life coaches, and professional advisors',
    emoji: '💼',
    bio: `I help professionals and businesses achieve their goals through strategic guidance and personalized coaching.

With years of experience in my field, I offer actionable insights that drive real results. Let's work together to unlock your potential.

Schedule a consultation to discuss your challenges and create a path forward.`,
    themeId: 'minimal',
    buttons: [
      { label: 'LinkedIn', url: 'https://linkedin.com/in/{username}', icon: 'linkedin' },
      { label: 'Website', url: 'https://{username}.com', icon: 'globe' },
      { label: 'Email Me', url: 'mailto:hello@{username}.com', icon: 'email' },
    ],
    talk: {
      title: 'Strategy Consultation',
      description: `A focused session to address your specific challenges and develop actionable strategies.

What to expect:
- Deep dive into your current situation
- Identification of key opportunities and challenges
- Actionable recommendations and next steps
- Follow-up notes and resources

Come prepared with your questions and goals. Let's make this time count!`,
      duration: 60,
      price: 150,
      location: 'online',
      meeting_platform: 'google_meet',
    },
    previewGradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  },
  {
    id: 'developer',
    name: 'Developer / Engineer',
    description: 'For software developers, engineers, and technical professionals',
    emoji: '👨‍💻',
    bio: `Software developer passionate about building great products and helping others level up their technical skills.

I offer pair programming sessions, code reviews, and technical mentorship. Whether you're stuck on a problem or want to learn new technologies, I'm here to help.

Let's write some code together!`,
    themeId: 'dark',
    buttons: [
      { label: 'GitHub', url: 'https://github.com/{username}', icon: 'github' },
      { label: 'Twitter', url: 'https://twitter.com/{username}', icon: 'twitter' },
      { label: 'LinkedIn', url: 'https://linkedin.com/in/{username}', icon: 'linkedin' },
    ],
    talk: {
      title: 'Code Review & Mentorship',
      description: `Get personalized feedback on your code and learn best practices directly from an experienced developer.

What we can cover:
- Code review and architecture feedback
- Debugging tricky issues together
- Learning new technologies and frameworks
- Career advice and interview prep
- Open source contribution guidance

Share your code beforehand so we can make the most of our time!`,
      duration: 45,
      price: 100,
      location: 'online',
      meeting_platform: 'google_meet',
    },
    previewGradient: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)',
  },
  {
    id: 'educator',
    name: 'Teacher / Educator',
    description: 'For tutors, instructors, and educational content creators',
    emoji: '📚',
    bio: `Passionate educator dedicated to making learning accessible and engaging.

I believe everyone can master new skills with the right guidance. My teaching approach focuses on understanding fundamentals and building practical skills.

Ready to learn something new? Let's start your journey!`,
    themeId: 'default',
    buttons: [
      { label: 'YouTube', url: 'https://youtube.com/@{username}', icon: 'youtube' },
      { label: 'Website', url: 'https://{username}.com', icon: 'globe' },
    ],
    talk: {
      title: 'Private Tutoring Session',
      description: `Personalized one-on-one tutoring tailored to your learning goals and pace.

Session includes:
- Assessment of your current level
- Customized lesson based on your needs
- Practice exercises and examples
- Homework and resources for continued learning

Tell me what you want to learn when you book!`,
      duration: 60,
      price: 75,
      location: 'online',
      meeting_platform: 'google_meet',
    },
    previewGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    id: 'blank',
    name: 'Start Fresh',
    description: 'Begin with a clean slate and build from scratch',
    emoji: '✨',
    bio: '',
    themeId: 'glass',
    buttons: [],
    talk: {
      title: 'Chat with Me',
      description: 'Book a time to chat!',
      duration: 30,
      price: 0,
      location: 'online',
      meeting_platform: 'google_meet',
    },
    previewGradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): OnboardingTemplate | undefined {
  return ONBOARDING_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Process template content with user-specific replacements
 */
export function processTemplateContent(
  content: string,
  replacements: { username?: string; displayName?: string }
): string {
  let processed = content;

  if (replacements.username) {
    processed = processed.replace(/{username}/g, replacements.username);
  }

  if (replacements.displayName) {
    processed = processed.replace(/{displayName}/g, replacements.displayName);
  }

  return processed;
}

/**
 * Process template buttons with user-specific replacements
 */
export function processTemplateButtons(
  buttons: TemplateButton[],
  replacements: { username?: string }
): TemplateButton[] {
  return buttons.map(button => ({
    ...button,
    url: processTemplateContent(button.url, replacements),
  }));
}
