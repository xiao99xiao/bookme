import { Toaster as Sonner, toast } from "sonner"
import { tokens } from "@/design-system/tokens"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          fontFamily: tokens.fonts.body,
          fontSize: tokens.fontSizes.small,
          borderRadius: tokens.borderRadius.md,
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-neutralLightest group-[.toaster]:shadow-lg",
          title: "font-semibold text-black",
          description: "group-[.toast]:text-neutral",
          actionButton:
            "group-[.toast]:bg-black group-[.toast]:text-white group-[.toast]:font-semibold group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-brandLightGrey group-[.toast]:text-neutral group-[.toast]:font-medium group-[.toast]:rounded-lg",
          success: "group-[.toaster]:bg-white group-[.toaster]:text-[#36d267] group-[.toaster]:border-[#36d267]/20",
          error: "group-[.toaster]:bg-white group-[.toaster]:text-[#F1343D] group-[.toaster]:border-[#F1343D]/20",
          warning: "group-[.toaster]:bg-white group-[.toaster]:text-[#FF9500] group-[.toaster]:border-[#FF9500]/20",
          info: "group-[.toaster]:bg-white group-[.toaster]:text-black group-[.toaster]:border-neutralLightest",
        },
        duration: 4000,
      }}
      position="top-right"
      richColors
      closeButton
      {...props}
    />
  )
}

export { Toaster, toast }
