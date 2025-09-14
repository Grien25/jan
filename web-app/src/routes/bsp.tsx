import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import { useTranslation } from '@/i18n/react-i18next-compat'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.bsp as any)({
  component: BSP,
})

function BSP() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col flex-justify-center">
      <HeaderPage />
      <div className="h-full px-4 md:px-8 overflow-y-auto flex flex-col gap-2 justify-center">
        <div className="w-full md:w-4/6 mx-auto">
          <div className="mb-8 text-center">
            <div className="text-6xl mb-4">🛝</div>
            <h1 className="font-editorialnew text-main-view-fg text-4xl">
              {t('common:bsp')}
            </h1>
            <p className="text-main-view-fg/70 text-lg mt-2">
              Batch Scripting Playground
            </p>
            <div className="mt-8 p-6 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
              <h2 className="text-main-view-fg text-xl font-semibold mb-2">
                🚧 Under Construction
              </h2>
              <p className="text-main-view-fg/60 text-sm">
                This feature is currently being developed. Check back soon for updates!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
