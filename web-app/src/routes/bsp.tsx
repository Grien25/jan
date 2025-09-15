import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import HeaderPage from '@/containers/HeaderPage'
import { useTranslation } from '@/i18n/react-i18next-compat'
import BSPInput from '@/containers/BSPInput'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useSearch } from '@tanstack/react-router'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.bsp as any)({
  component: BSP,
})

function BSP() {
  const { t } = useTranslation()
  const { providers } = useModelProvider()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search = useSearch({ from: route.bsp as any })
  const selectedModel = search.model

  // Conditional to check if there are any valid providers
  // required min 1 api_key or 1 model in llama.cpp or jan provider
  const hasValidProviders = providers.some(
    (provider) =>
      provider.api_key?.length ||
      (provider.provider === 'llamacpp' && provider.models.length) ||
      (provider.provider === 'jan' && provider.models.length)
  )

  if (!hasValidProviders) {
    return (
      <div className="flex h-full flex-col flex-justify-center">
        <HeaderPage />
        <div className="h-full px-4 md:px-8 overflow-y-auto flex flex-col gap-2 justify-center">
          <div className="w-full md:w-4/6 mx-auto text-center">
            <div className="text-6xl mb-4">🛝</div>
            <h1 className="font-editorialnew text-main-view-fg text-4xl">
              {t('common:bsp')}
            </h1>
            <p className="text-main-view-fg/70 text-lg mt-2">
              Batch Scripting Playground
            </p>
            <div className="mt-8 p-6 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
              <h2 className="text-main-view-fg text-xl font-semibold mb-2">
                ⚙️ Setup Required
              </h2>
              <p className="text-main-view-fg/60 text-sm">
                Please configure a model provider in settings to use the Batch Scripting Playground.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <HeaderPage />
      <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <div className="text-6xl mb-4">🛝</div>
            <h1 className="font-editorialnew text-main-view-fg text-4xl mb-2">
              {t('common:bsp')}
            </h1>
            <p className="text-main-view-fg/70 text-lg mb-2">
              Batch Scripting Playground
            </p>
            <p className="text-main-view-fg/50 text-sm">
              Use /var in your prompt to create variables that can be replaced with different values
            </p>
          </div>
          
          <div className="mb-6">
            <BSPInput
              showSpeedToken={false}
              model={selectedModel}
              initialMessage={true}
            />
          </div>

          {/* Suggestion boxes */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              "Write a story about /var",
              "Explain /var in simple terms", 
              "Create a recipe for /var",
              "What are the benefits of /var?",
              "How does /var work?",
              "Tell me about /var history"
            ].map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  // This would set the prompt in the input
                  console.log('Suggestion clicked:', suggestion)
                }}
                className="p-3 bg-main-view-fg/5 border border-main-view-fg/10 rounded-lg text-left text-sm text-main-view-fg/70 hover:bg-main-view-fg/10 hover:border-main-view-fg/20 transition-all duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
