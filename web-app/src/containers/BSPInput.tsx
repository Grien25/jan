'use client'

import TextareaAutosize from 'react-textarea-autosize'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ArrowRight, ChevronUp, ChevronDown } from 'lucide-react'
import {
  IconPhoto,
  IconWorld,
  IconAtom,
  IconTool,
  IconCodeCircle2,
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useGeneralSetting } from '@/hooks/useGeneralSetting'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useAppState } from '@/hooks/useAppState'
import { MovingBorder } from './MovingBorder'
import { useChat } from '@/hooks/useChat'
import DropdownModelProvider from '@/containers/DropdownModelProvider'
import { ModelLoader } from '@/containers/loaders/ModelLoader'
import DropdownToolsAvailable from '@/containers/DropdownToolsAvailable'
import { useServiceHub } from '@/hooks/useServiceHub'

type BSPInputProps = {
  className?: string
  showSpeedToken?: boolean
  model?: ThreadModel
  initialMessage?: boolean
}

const BSPInput = ({ model, className, initialMessage }: BSPInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [rows, setRows] = useState(1)
  const [prompt, setPrompt] = useState('')
  const [variables, setVariables] = useState<string[]>(['', '', '', ''])
  const [variableCount, setVariableCount] = useState(2)
  const [message, setMessage] = useState('')
  
  const serviceHub = useServiceHub()
  const {
    streamingContent,
    abortControllers,
    loadingModel,
    tools,
    cancelToolCall,
  } = useAppState()
  const { currentThreadId } = useThreads()
  const { t } = useTranslation()
  const { spellCheckChatInput } = useGeneralSetting()

  const maxRows = 10

  const { selectedModel, selectedProvider } = useModelProvider()
  const { sendMessage } = useChat()
  const [dropdownToolsAvailable, setDropdownToolsAvailable] = useState(false)
  const [tooltipToolsAvailable, setTooltipToolsAvailable] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      name: string
      type: string
      size: number
      base64: string
      dataUrl: string
    }>
  >([])
  const [connectedServers, setConnectedServers] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [hasMmproj, setHasMmproj] = useState(false)

  // Check for connected MCP servers
  useEffect(() => {
    const checkConnectedServers = async () => {
      try {
        const servers = await serviceHub.mcp().getConnectedServers()
        setConnectedServers(servers)
      } catch (error) {
        console.error('Failed to get connected servers:', error)
        setConnectedServers([])
      }
    }

    checkConnectedServers()

    // Poll for connected servers every 3 seconds
    const intervalId = setInterval(checkConnectedServers, 3000)

    return () => clearInterval(intervalId)
  }, [serviceHub])

  // Check if model has mmproj support
  useEffect(() => {
    if (selectedModel?.mmproj) {
      setHasMmproj(true)
    } else {
      setHasMmproj(false)
    }
  }, [selectedModel])

  const handleSendMesage = useCallback(
    async (message: string) => {
      if (!message.trim() && uploadedFiles.length === 0) return

      // Replace /var with actual variables
      let processedMessage = message
      const varMatches = message.match(/\/var/g)
      if (varMatches) {
        const activeVariables = variables.slice(0, variableCount).filter(v => v.trim())
        if (activeVariables.length > 0) {
          // For now, just replace with the first variable
          // Later we can implement batch processing
          processedMessage = message.replace(/\/var/g, activeVariables[0])
        }
      }

      try {
        await sendMessage({
          message: processedMessage,
          files: uploadedFiles,
          model: selectedModel,
          threadId: currentThreadId,
        })
        setPrompt('')
        setUploadedFiles([])
        setMessage('')
      } catch (error) {
        console.error('Error sending message:', error)
        setMessage('Failed to send message. Please try again.')
      }
    },
    [
      message,
      uploadedFiles,
      variables,
      variableCount,
      sendMessage,
      selectedModel,
      currentThreadId,
    ]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMesage(prompt)
      }
    },
    [handleSendMesage, prompt]
  )

  const handleVariableChange = (index: number, value: string) => {
    if (value.length <= 10) {
      const newVariables = [...variables]
      newVariables[index] = value
      setVariables(newVariables)
    }
  }

  const handleVariableCountChange = (newCount: number) => {
    if (newCount >= 2 && newCount <= 4) {
      setVariableCount(newCount)
    }
  }

  const renderPromptWithHighlighting = () => {
    if (!prompt) return null
    
    const parts = prompt.split(/(\/var)/g)
    return parts.map((part, index) => {
      if (part === '/var') {
        return (
          <span
            key={index}
            className="bg-blue-500/20 text-blue-400 px-1 rounded"
          >
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <div className={cn('relative w-full', className)}>
      <div
        className={cn(
          'relative flex flex-col w-full rounded-lg border border-main-view-fg/20 bg-main-view-fg/5 transition-all duration-200 ease-in-out',
          isFocused && 'border-main-view-fg/40 bg-main-view-fg/10',
          isDragOver && 'border-primary/50 bg-primary/5'
        )}
      >
        <div className="relative flex-1">
          <TextareaAutosize
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask me anything... Use /var for variables"
            className={cn(
              'w-full resize-none border-0 bg-transparent px-4 py-3 text-main-view-fg placeholder:text-main-view-fg/50 focus:outline-none focus:ring-0',
              spellCheckChatInput ? '' : 'spellcheck="false"'
            )}
            maxRows={maxRows}
            minRows={1}
            onHeightChange={(height) => {
              const newRows = Math.ceil(height / 24)
              setRows(newRows)
            }}
          />
        </div>

        <div className="absolute z-20 bg-transparent bottom-0 w-full p-2 ">
          <div className="flex justify-between items-center w-full">
            <div className="px-1 flex items-center gap-1">
              <div
                className={cn(
                  'px-1 flex items-center',
                  streamingContent && 'opacity-50 pointer-events-none'
                )}
              >
                {model?.provider === 'llamacpp' && loadingModel ? (
                  <ModelLoader />
                ) : (
                  <DropdownModelProvider
                    model={model}
                    useLastUsedModel={initialMessage}
                  />
                )}
                {/* File attachment - show only for models with mmproj */}
                {hasMmproj && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1"
                        >
                          <IconPhoto
                            size={18}
                            className="text-main-view-fg/50"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('vision')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {streamingContent ? (
              <Button
                variant="destructive"
                size="icon"
                onClick={() =>
                  // stopStreaming(currentThreadId ?? streamingContent.thread_id)
                  console.log('Stop streaming')
                }
              >
                <IconPlayerStopFilled />
              </Button>
            ) : (
              <Button
                variant={
                  !prompt.trim() && uploadedFiles.length === 0
                    ? null
                    : 'default'
                }
                size="icon"
                disabled={!prompt.trim() && uploadedFiles.length === 0}
                data-test-id="send-message-button"
                onClick={() => handleSendMesage(prompt)}
              >
                {streamingContent ? (
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  <ArrowRight className="text-primary-fg" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Variable Input Boxes */}
      {prompt.includes('/var') && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-main-view-fg/70">
              Variable Values (max 10 characters each)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-main-view-fg/50">Count:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVariableCountChange(variableCount - 1)}
                  disabled={variableCount <= 2}
                  className="h-6 w-6 p-0"
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <span className="text-sm font-medium w-4 text-center">
                  {variableCount}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVariableCountChange(variableCount + 1)}
                  disabled={variableCount >= 4}
                  className="h-6 w-6 p-0"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: variableCount }, (_, index) => (
              <input
                key={index}
                type="text"
                value={variables[index] || ''}
                onChange={(e) => handleVariableChange(index, e.target.value)}
                placeholder={`Variable ${index + 1}`}
                maxLength={10}
                className="w-full px-3 py-2 text-sm bg-main-view-fg/5 border border-main-view-fg/20 rounded-md text-main-view-fg placeholder:text-main-view-fg/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
            ))}
          </div>
        </div>
      )}

      {message && (
        <div className="bg-main-view-fg/2 -mt-0.5 mx-2 pb-2 px-3 pt-1.5 rounded-b-lg text-xs text-destructive transition-all duration-200 ease-in-out">
          <div className="flex items-center gap-1 justify-between">
            {message}
            <IconX
              className="size-3 text-main-view-fg/30 cursor-pointer"
              onClick={() => setMessage('')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default BSPInput
