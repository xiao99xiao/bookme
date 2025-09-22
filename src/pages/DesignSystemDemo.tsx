import { Edit2, Trash2, Plus, Clock, DollarSign, MapPin, Calendar, MessageSquare, Search, Users } from 'lucide-react';
import { 
  Container, 
  Card, 
  Stack, 
  Grid, 
  Heading, 
  Text, 
  Button, 
  Badge,
  Input,
  Textarea,
  Label,
  Loading,
  PageLoading,
  CardSkeleton,
  ButtonLoading,
  EmptyState,
  BookingEmptyState,
  NoResultsFound,
  NoDataYet,
  EmptyListState
} from '@/design-system';
import { ServiceCard } from '@/components/ServiceCard';
// import RefactoredNavigation from '@/components/RefactoredNavigation'; // Removed - component deleted

const sampleService = {
  id: '1',
  title: 'Meet offline',
  description: 'Buy me a coffee and talk for 1 hour',
  price: 50,
  duration_minutes: 60,
  is_online: true,
  meeting_platform: 'google_meet',
  is_visible: true,
  timeSlots: { '1': true, '2': true, '3': true, '4': true, '5': true },
};

export default function DesignSystemDemo() {
  return (
    <div className="bg-brandBgGrey2">
      
      <Container maxWidth="xl" className="pt-24">
        <Stack spacing="3xl">
          {/* Header */}
          <Stack spacing="lg">
            <Heading as="h1" className="text-4xl">Design System Demo</Heading>
            <Text color="secondary">
              Testing our new design system components based on Figma specifications
            </Text>
          </Stack>

          {/* Typography Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Typography</Heading>
              <Grid columns={2} spacing="lg">
                <Stack spacing="md">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">HEADINGS</Text>
                  <Heading as="h1" className="text-4xl">Heading H1 (32px)</Heading>
                  <Heading as="h2" className="text-3xl">Heading H2 (24px)</Heading>
                  <Heading as="h3" className="text-xl">Heading H3 (20px)</Heading>
                </Stack>
                <Stack spacing="md">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">BODY TEXT</Text>
                  <Text variant="medium" weight="semibold">Medium Semi Bold (18px)</Text>
                  <Text variant="regular">Regular text (16px)</Text>
                  <Text variant="small">Small text (14px)</Text>
                  <Text variant="tiny">Tiny text (12px)</Text>
                  <Text variant="small" color="secondary">Secondary text</Text>
                  <Text variant="small" color="tertiary">Tertiary text</Text>
                </Stack>
              </Grid>
            </Stack>
          </Card>

          {/* Buttons Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Buttons</Heading>
              <Grid columns={2} spacing="lg">
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">VARIANTS</Text>
                  <Stack spacing="md">
                    <Button>Primary Button</Button>
                    <Button variant="secondary">Secondary Button</Button>
                    <Button variant="tertiary">Tertiary Button</Button>
                    <Button variant="link">Link Button</Button>
                    <Button variant="success" icon={<Plus className="w-4 h-4" />}>Mark Complete</Button>
                    <Button variant="warning">Review</Button>
                    <Button variant="danger">Cancel</Button>
                    <Button variant="outline" icon={<Edit2 className="w-4 h-4" />}>Copy Link</Button>
                  </Stack>
                </Stack>
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">WITH ICONS</Text>
                  <Stack spacing="md">
                    <Button icon={<Plus className="w-4 h-4" />} iconPosition="leading">
                      Add Service
                    </Button>
                    <Button variant="secondary" icon={<Edit2 className="w-4 h-4" />} iconPosition="trailing">
                      Edit
                    </Button>
                    <Button variant="tertiary" icon={<Trash2 className="w-4 h-4" />} iconPosition="only" />
                  </Stack>
                </Stack>
              </Grid>
            </Stack>
          </Card>

          {/* Badges Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Badges</Heading>
              <Stack direction="row" spacing="md">
                <Badge icon={<Clock className="w-4 h-4" />}>60 min</Badge>
                <Badge icon={<DollarSign className="w-4 h-4" />}>50</Badge>
                <Badge icon={<MapPin className="w-4 h-4" />}>Online</Badge>
                <Badge variant="yellow">18 slots</Badge>
                <Badge variant="secondary">Coming Soon</Badge>
              </Stack>
            </Stack>
          </Card>

          {/* Forms Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Form Components</Heading>
              <Grid columns={2} spacing="lg">
                <Stack spacing="lg">
                  <Stack spacing="sm">
                    <Label>Service Title</Label>
                    <Input placeholder="e.g., JavaScript Programming Fundamentals" />
                  </Stack>
                  
                  <Stack spacing="sm">
                    <Label>Description</Label>
                    <Textarea 
                      rows={4}
                      placeholder="Describe what you'll cover, who it's for, and what participants will learn."
                    />
                  </Stack>
                </Stack>
                
                <Stack spacing="lg">
                  <Stack spacing="sm">
                    <Label>Price (Error State)</Label>
                    <Input placeholder="Enter price" error />
                    <Text variant="tiny" className="text-red-600">Price is required</Text>
                  </Stack>
                  
                  <Stack spacing="sm">
                    <Label>Location Type</Label>
                    <select className="w-full h-12 px-3 py-2 pr-10 text-base border border-neutralLightest rounded-ds-sm focus:outline-none focus:border-blue-500 appearance-none bg-white">
                      <option>💻 Online</option>
                      <option>📞 Phone</option>
                      <option>📍 In-Person</option>
                    </select>
                  </Stack>
                </Stack>
              </Grid>
            </Stack>
          </Card>

          {/* Service Cards Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Service Cards</Heading>
              <Grid columns={1} spacing="lg">
                <ServiceCard 
                  service={sampleService}
                  variant="full"
                  onEdit={() => console.log('Edit')}
                  onDelete={() => console.log('Delete')}
                  onToggleVisibility={() => console.log('Toggle visibility')}
                />
                <ServiceCard 
                  service={{ ...sampleService, title: 'Pet Sitting Service', description: 'Help feed your pets when you\'re away from home.', is_online: false, price: 12, duration_minutes: 30 }}
                  variant="preview" 
                  showActions={false}
                />
              </Grid>
            </Stack>
          </Card>

          {/* Empty States Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Empty States</Heading>
              <Grid columns={2} spacing="lg">
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">BASIC VARIANTS</Text>
                  <Stack spacing="md">
                    <div className="p-4 bg-muted/20 rounded">
                      <EmptyState
                        icon={<Search className="w-full h-full" />}
                        title="No services found"
                        description="Try adjusting your search criteria"
                        action={{ 
                          text: "Clear Filters", 
                          onClick: () => console.log('Clear filters'), 
                          variant: "secondary" 
                        }}
                      />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <EmptyState
                        icon={<Calendar className="w-full h-full" />}
                        title="No bookings yet"
                        description="Browse services and make your first booking"
                        size="sm"
                        variant="minimal"
                      />
                    </div>
                  </Stack>
                </Stack>
                
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">SPECIALIZED COMPONENTS</Text>
                  <Stack spacing="md">
                    <div className="p-4 bg-muted/20 rounded">
                      <BookingEmptyState 
                        type="upcoming"
                        onBrowseServices={() => console.log('Browse services')}
                      />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <NoResultsFound 
                        searchTerm="JavaScript"
                        onClear={() => console.log('Clear search')}
                      />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <NoDataYet
                        title="No messages yet"
                        description="Start a conversation with a service provider"
                        icon={<MessageSquare className="w-full h-full" />}
                        actionText="Browse Services"
                        onAction={() => console.log('Browse services')}
                      />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <EmptyListState
                        itemType="Services"
                        addText="Create Service"
                        onAdd={() => console.log('Add service')}
                        icon={<Users className="w-full h-full" />}
                      />
                    </div>
                  </Stack>
                </Stack>
              </Grid>
              
              <Stack spacing="lg">
                <Text variant="small" color="tertiary" className="uppercase tracking-wide">SIZE & VARIANT EXAMPLES</Text>
                <Grid columns={3} spacing="lg">
                  <Card padding="lg" className="min-h-[200px]">
                    <EmptyState
                      icon={<Calendar className="w-full h-full" />}
                      title="Small Empty State"
                      description="Compact version for smaller spaces"
                      size="sm"
                    />
                  </Card>
                  <Card padding="lg" className="min-h-[200px]">
                    <EmptyState
                      icon={<Search className="w-full h-full" />}
                      title="Medium Empty State"
                      description="Standard size for most use cases"
                      size="md"
                      action={{ 
                        text: "Try Again", 
                        onClick: () => console.log('Try again'), 
                        variant: "primary" 
                      }}
                    />
                  </Card>
                  <Card padding="lg" className="min-h-[200px]">
                    <EmptyState
                      icon={<MessageSquare className="w-full h-full" />}
                      title="Large Empty State"
                      description="Spacious version for prominent empty states with multiple actions"
                      size="lg"
                      action={{ 
                        text: "Get Started", 
                        onClick: () => console.log('Get started'), 
                        variant: "primary",
                        icon: <Plus className="w-4 h-4" />
                      }}
                      secondaryAction={{ 
                        text: "Learn More", 
                        onClick: () => console.log('Learn more'), 
                        variant: "secondary" 
                      }}
                    />
                  </Card>
                </Grid>
              </Stack>
            </Stack>
          </Card>

          {/* Loading Components Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Loading Components</Heading>
              <Grid columns={2} spacing="xl">
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">SPINNER VARIANTS</Text>
                  <Stack spacing="md">
                    <div className="p-4 bg-muted/20 rounded">
                      <Loading variant="spinner" size="sm" text="Loading..." />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <Loading variant="spinner" size="md" text="Loading services..." />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <Loading variant="spinner" size="lg" text="Processing payment..." />
                    </div>
                  </Stack>
                </Stack>
                
                <Stack spacing="lg">
                  <Text variant="small" color="tertiary" className="uppercase tracking-wide">OTHER VARIANTS</Text>
                  <Stack spacing="md">
                    <div className="p-4 bg-muted/20 rounded">
                      <Loading variant="dots" text="Connecting..." />
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <ButtonLoading loading={true}>
                        Cancel Booking
                      </ButtonLoading>
                    </div>
                    <div className="p-4 bg-muted/20 rounded">
                      <Loading variant="inline" text="Uploading file..." />
                    </div>
                  </Stack>
                </Stack>
              </Grid>
              
              <Stack spacing="lg">
                <Text variant="small" color="tertiary" className="uppercase tracking-wide">SKELETON LOADING</Text>
                <Grid columns={2} spacing="lg">
                  <div className="p-4 bg-muted/20 rounded">
                    <Loading variant="skeleton" lines={3} />
                  </div>
                  <CardSkeleton lines={4} />
                </Grid>
              </Stack>
            </Stack>
          </Card>

          {/* Layout Section */}
          <Card>
            <Stack spacing="xl">
              <Heading as="h2">Layout Components</Heading>
              <Grid columns={3} spacing="lg">
                <Card padding="lg" className="bg-brandLightYellow">
                  <Stack spacing="md">
                    <Text weight="semibold">Card with Yellow Background</Text>
                    <Text variant="small" color="secondary">Custom background using design system colors</Text>
                  </Stack>
                </Card>
                <Card padding="lg">
                  <Stack spacing="md">
                    <Text weight="semibold">Default Card</Text>
                    <Text variant="small" color="secondary">Standard white background</Text>
                  </Stack>
                </Card>
                <Card padding="lg" className="border-brandYellow bg-brandLightYellow">
                  <Stack spacing="md">
                    <Text weight="semibold">Highlighted Card</Text>
                    <Text variant="small" color="secondary">With branded border and background</Text>
                  </Stack>
                </Card>
              </Grid>
            </Stack>
          </Card>
        </Stack>
      </Container>
    </div>
  );
}