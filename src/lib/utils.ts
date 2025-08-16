import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateAvatar(name: string): string {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const color = colors[name.length % colors.length];
  
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='${encodeURIComponent(color)}'/%3E%3Ctext x='20' y='25' text-anchor='middle' fill='white' font-size='16' font-family='Arial'%3E${initials}%3C/text%3E%3C/svg%3E`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function getSlotCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    consultation: '💡',
    coaching: '🎯',
    tutoring: '📚',
    fitness: '💪',
    creative: '🎨',
    other: '⚡'
  };
  return emojis[category] || '📅';
}

export function getLocationIcon(location: string): string {
  const icons: Record<string, string> = {
    online: '💻',
    phone: '📞',
    'in-person': '📍'
  };
  return icons[location] || '📍';
}