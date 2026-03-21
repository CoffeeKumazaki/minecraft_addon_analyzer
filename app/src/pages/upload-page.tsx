import { UploadArea } from '@/components/upload/upload-area'

export function UploadPage() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-16 min-h-[calc(100vh-112px)]">
      <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-[-2px] mb-3 text-center leading-tight">
        Minecraft Bedrock
        <br />
        Add-on Analyzer
      </h1>
      <p className="text-muted-foreground mb-8 text-center max-w-lg">
        Analyze your add-on contents — items, blocks, entities, recipes & references
      </p>
      <UploadArea />
      <p className="text-xs text-muted-foreground mt-6 tracking-[1px]">
        .mcaddon &middot; .mcpack &middot; .mcworld &middot; .zip
      </p>
    </div>
  )
}
