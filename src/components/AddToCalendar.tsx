import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

interface AddToCalendarProps {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  isOnline?: boolean;
}

export default function AddToCalendar({
  title,
  description,
  startDate,
  endDate,
  location,
  isOnline,
}: AddToCalendarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Format dates for Google Calendar (YYYYMMDDTHHmmssZ format)
  const formatDateForGoogle = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  // Format dates for ICS file
  const formatDateForICS = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  // Generate Google Calendar URL
  const generateGoogleCalendarUrl = () => {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
      details: description || '',
      location: isOnline ? 'Online Meeting' : (location || ''),
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // Generate ICS file content
  const generateICSContent = () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nook//Booking Calendar//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@nook.to`,
      `DTSTAMP:${formatDateForICS(new Date())}`,
      `DTSTART:${formatDateForICS(startDate)}`,
      `DTEND:${formatDateForICS(endDate)}`,
      `SUMMARY:${title}`,
      description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
      location ? `LOCATION:${isOnline ? 'Online Meeting' : location}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    return icsContent;
  };

  // Handle Google Calendar click
  const handleGoogleCalendar = () => {
    const url = generateGoogleCalendarUrl();
    window.open(url, '_blank');
    setIsOpen(false);
  };

  // Handle ICS download
  const handleICSDownload = () => {
    const icsContent = generateICSContent();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Calendar className="w-4 h-4 mr-1" />
          Add to Calendar
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleGoogleCalendar}>
          <svg
            className="w-4 h-4 mr-2"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M19.5 3.5L18 2L17 3.5L16 2L15 3.5L14 2L13 3.5L12 2L11 3.5L10 2L9 3.5L8 2L7 3.5L6 2L5 3.5L4.5 2V22L6 20.5L7 22L8 20.5L9 22L10 20.5L11 22L12 20.5L13 22L14 20.5L15 22L16 20.5L17 22L18 20.5L19.5 22V2L19.5 3.5Z"
              fill="#4285F4"
            />
            <path d="M8 9H16V11H8V9Z" fill="white" />
            <path d="M8 13H13V15H8V13Z" fill="white" />
          </svg>
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleICSDownload}>
          <Calendar className="w-4 h-4 mr-2 text-blue-600" />
          Download .ics file
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}