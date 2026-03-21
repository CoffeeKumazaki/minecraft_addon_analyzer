import { UploadArea } from '@/components/upload/upload-area'

export function UploadPage() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Minecraft Bedrock Add-on Analyzer
      </h1>
      <p className="text-muted-foreground mb-8 text-center max-w-md">
        Add-on の中身を解析し、追加要素・挙動・参照関係を可視化します
      </p>
      <UploadArea />
      <p className="text-xs text-muted-foreground mt-4">
        .mcaddon, .mcpack, .mcworld, .zip に対応
      </p>
    </div>
  )
}
