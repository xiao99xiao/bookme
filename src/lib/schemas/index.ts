/**
 * BookMe API Schemas
 *
 * Centralized export for all Zod schemas used for API contract validation.
 * These schemas define the expected shape of API responses and can be used for:
 * - Runtime validation of API responses
 * - Type inference for TypeScript
 * - Contract testing
 */

// Common schemas
export {
  UUIDSchema,
  DateTimeSchema,
  NullableString,
  NullableURL,
  PaginationSchema,
  ErrorResponseSchema,
  createPaginatedResponseSchema,
  type UUID,
  type DateTime,
  type Pagination,
  type ErrorResponse,
} from './common.schema';

// User schemas
export {
  UserMinimalSchema,
  UserSchema,
  UserUpdateSchema,
  type UserMinimal,
  type User,
  type UserUpdate,
} from './user.schema';

// Service schemas
export {
  MeetingPlatformSchema,
  AvailabilityScheduleSchema,
  ServiceSchema,
  ServiceWithProviderSchema,
  ServiceCreateSchema,
  type MeetingPlatform,
  type AvailabilitySchedule,
  type Service,
  type ServiceWithProvider,
  type ServiceCreate,
} from './service.schema';

// Booking schemas
export {
  BookingStatusSchema,
  ReviewMinimalSchema,
  BookingBaseSchema,
  BookingWithRelationsSchema,
  EIP712AuthorizationSchema,
  FeeBreakdownSchema,
  CreateBookingResponseSchema,
  PaymentAuthorizationResponseSchema,
  BookingCreateSchema,
  type BookingStatus,
  type ReviewMinimal,
  type BookingBase,
  type BookingWithRelations,
  type EIP712Authorization,
  type FeeBreakdown,
  type CreateBookingResponse,
  type PaymentAuthorizationResponse,
  type BookingCreate,
} from './booking.schema';

// Conversation & Message schemas
export {
  MessageSchema,
  ConversationBookingSchema,
  ConversationSchema,
  ConversationsResponseSchema,
  MessagesResponseSchema,
  MessageCreateSchema,
  MarkReadResponseSchema,
  type Message,
  type ConversationBooking,
  type Conversation,
  type ConversationsResponse,
  type MessagesResponse,
  type MessageCreate,
  type MarkReadResponse,
} from './conversation.schema';

// Theme schemas
export {
  ThemeIdSchema,
  ThemeColorsSchema,
  ThemeTypographySchema,
  ThemeSpacingSchema,
  ThemeConfigSchema,
  ThemeSettingsSchema,
  UserThemeResponseSchema,
  UpdateThemeRequestSchema,
  UpdateThemeResponseSchema,
  type ThemeId,
  type ThemeColors,
  type ThemeTypography,
  type ThemeSpacing,
  type ThemeConfig,
  type ThemeSettings,
  type UserThemeResponse,
  type UpdateThemeRequest,
  type UpdateThemeResponse,
} from './theme.schema';
