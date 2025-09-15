'use client'

import TextareaAutosize from 'react-textarea-autosize'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronUp, ChevronDown } from 'lucide-react'
import {
  IconPlayerStopFilled,
  IconX,
  IconPhoto,
  IconWorld,
  IconAtom,
  IconTool,
  IconCodeCircle2,
} from '@tabler/icons-react'
import { useGeneralSetting } from '@/hooks/useGeneralSetting'
import { useModelProvider } from '@/hooks/useModelProvider'
import { useAppState } from '@/hooks/useAppState'
import { useChat } from '@/hooks/useChat'
import { useThreads } from '@/hooks/useThreads'
import { useMessages } from '@/hooks/useMessages'
import { useRouter } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import DropdownModelProvider from '@/containers/DropdownModelProvider'
import { ModelLoader } from '@/containers/loaders/ModelLoader'
import { defaultModel } from '@/lib/models'
import { ThreadMessage } from '@janhq/core'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import DropdownToolsAvailable from '@/containers/DropdownToolsAvailable'
import { useServiceHub } from '@/hooks/useServiceHub'

type BSPInputProps = {
  className?: string
  showSpeedToken?: boolean
  model?: ThreadModel
  initialMessage?: boolean
}

const BSPInput = ({ className, model, initialMessage }: BSPInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [variables, setVariables] = useState<string[]>(['', '', '', ''])
  const [variableCount, setVariableCount] = useState(2)
  const [message, setMessage] = useState('')
  // Batch processing handled sequentially via await, no extra state
  
  const { streamingContent } = useAppState()
  const { spellCheckChatInput } = useGeneralSetting()
  const { selectedModel, selectedProvider } = useModelProvider()
  const { loadingModel } = useAppState()
  const serviceHub = useServiceHub()

  const maxRows = 10

  const { sendMessage } = useChat()
  const { createThread, getCurrentThread } = useThreads()
  const { getMessages } = useMessages()
  const router = useRouter()
  const [dropdownToolsAvailable, setDropdownToolsAvailable] = useState(false)
  const [tooltipToolsAvailable, setTooltipToolsAvailable] = useState(false)
  const [connectedServers, setConnectedServers] = useState<string[]>([])
  const [hasMmproj, setHasMmproj] = useState(false)
  const [saveAsMarkdownMode, setSaveAsMarkdownMode] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      name: string
      type: string
      size: number
      base64: string
      dataUrl: string
    }>
  >([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAttachmentClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = (indexToRemove: number) => {
    setUploadedFiles((prev) => prev.filter((_, index) => index !== indexToRemove))
  }

  const getFileTypeFromExtension = (fileName: string): string => {
    const extension = fileName.toLowerCase().split('.').pop()
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      default:
        return ''
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files

    if (files && files.length > 0) {
      const maxSize = 10 * 1024 * 1024 // 10MB
      const newFiles: Array<{
        name: string
        type: string
        size: number
        base64: string
        dataUrl: string
      }> = []

      Array.from(files).forEach((file) => {
        if (file.size > maxSize) {
          setMessage(`File is too large. Maximum size is 10MB.`)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        const detectedType = file.type || getFileTypeFromExtension(file.name)
        const actualType = getFileTypeFromExtension(file.name) || detectedType

        const allowedTypes = ['image/jpg', 'image/jpeg', 'image/png']
        if (!allowedTypes.includes(actualType)) {
          setMessage(`Only JPEG, JPG, and PNG files are allowed.`)
          if (fileInputRef.current) fileInputRef.current.value = ''
          return
        }

        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          if (typeof result === 'string') {
            const base64String = result.split(',')[1]
            const fileData = {
              name: file.name,
              size: file.size,
              type: actualType,
              base64: base64String,
              dataUrl: result,
            }
            newFiles.push(fileData)
            if (newFiles.length === Array.from(files).filter((f) => {
              const fType = getFileTypeFromExtension(f.name) || f.type
              return f.size <= maxSize && allowedTypes.includes(fType)
            }).length) {
              setUploadedFiles((prev) => [...prev, ...newFiles])
              if (fileInputRef.current) {
                fileInputRef.current.value = ''
                setMessage('')
              }
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }

    if (textareaRef.current) textareaRef.current.focus()
  }

  // Helper: extract text from thread message content
  type TextPart = { type: 'text'; text?: { value?: string } }
  type ImagePart = { type: 'image'; image_url?: { url?: string } }
  type ContentPart = TextPart | ImagePart | { type: string }

  const getTextFromMessage = (msg?: ThreadMessage): string => {
    if (!msg || !Array.isArray(msg.content)) return ''
    return msg.content
      .map((part: ContentPart) => {
        if (part.type === 'text' && part.text?.value) return part.text.value
        if (part.type === 'image' && part.image_url?.url) return `![image](${part.image_url.url})`
        return ''
      })
      .filter(Boolean)
      .join('\n\n')
  }

  // Helper: save the last user/assistant exchange as markdown
  const saveLastExchangeAsMarkdown = async (baseName: string) => {
    try {
      const current = await getCurrentThread()
      if (!current?.id) return
      const messages = getMessages(current.id)
      if (!messages.length) return
      // Assume last two are user then assistant for this exchange
      const last = messages[messages.length - 1]
      const prev = messages[messages.length - 2]
      // Find last user message
      let userMsg = prev && prev.role === 'user' ? prev : undefined
      if (!userMsg) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
            userMsg = messages[i]
            break
          }
        }
      }
      // Find last assistant message
      let assistantMsg = last && last.role === 'assistant' ? last : undefined
      if (!assistantMsg) {
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant') {
            assistantMsg = messages[i]
            break
          }
        }
      }

      const userText = getTextFromMessage(userMsg)
      const assistantText = getTextFromMessage(assistantMsg)
      const md = `# BSP Export\n\n## Prompt\n\n${userText}\n\n---\n\n## Response\n\n${assistantText}\n`

      if (IS_WEB_APP) {
        // Fallback for web: trigger download
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.md`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        return
      }

      // Desktop (Tauri): save to Documents/BSP
      const { documentDir, join } = await import('@tauri-apps/api/path')
      const docs = await documentDir()
      const targetDir = await join(docs, 'BSP')
      // Ensure directory exists
      await serviceHub.core().invoke('mkdir', { args: [targetDir] })
      const filePath = await join(targetDir, `${baseName}.md`)
      await serviceHub.core().invoke('write_file_sync', { args: [filePath, md] })
    } catch (error) {
      console.error('Failed to save markdown:', error)
      setMessage('Failed to save markdown to Documents/BSP')
    }
  }

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

    const intervalId = setInterval(checkConnectedServers, 3000)
    return () => clearInterval(intervalId)
  }, [serviceHub])

  // Simple mmproj check: use model capability
  useEffect(() => {
    if (selectedModel && selectedModel?.id) {
      if (selectedModel?.capabilities?.includes('vision')) {
        setHasMmproj(true)
      } else {
        setHasMmproj(false)
      }
    }
  }, [selectedModel, selectedModel?.capabilities])

  // Removed effect-based batch chaining; handled sequentially in send flow

  const handleSendMesage = useCallback(
    async (message: string) => {
      if (!message.trim() && uploadedFiles.length === 0) return

      // Replace /var with actual variables
      const varMatches = message.match(/\/var/g)
      if (varMatches) {
        const activeVariables = variables.slice(0, variableCount).filter(v => v.trim())
        if (activeVariables.length > 0) {
          // Create batch of messages with different variable values
          const batchMessages = activeVariables.map(variable => 
            message.replace(/\/var/g, variable)
          )
          try {
            // Send each variation sequentially, creating a new thread for each after the first
            for (let i = 0; i < batchMessages.length; i++) {
              const msg = batchMessages[i]
              if (i === 0) {
                await sendMessage(
                  msg,
                  true,
                  uploadedFiles.length > 0 ? uploadedFiles : undefined
                )
              } else {
                if (saveAsMarkdownMode) {
                  // Stay in current thread, send and save last exchange as markdown
                  await sendMessage(
                    msg,
                    true,
                    uploadedFiles.length > 0 ? uploadedFiles : undefined
                  )
                  await saveLastExchangeAsMarkdown(`BSP Variation ${i + 1}`)
                } else {
                  const newThread = await createThread(
                    {
                      id: selectedModel?.id ?? defaultModel(selectedProvider),
                      provider: selectedProvider,
                    },
                    `BSP Variation ${i + 1}`
                  )
                  await router.navigate({
                    to: route.threadsDetail,
                    params: { threadId: newThread.id },
                  })
                  await sendMessage(
                    msg,
                    true,
                    uploadedFiles.length > 0 ? uploadedFiles : undefined
                  )
                }
              }
            }
            // Reset local UI state after batch finishes
            setPrompt('')
            setUploadedFiles([])
            setMessage('')
          } catch (error) {
            console.error('Error sending batch messages:', error)
            setMessage('Failed to process batch. Please try again.')
          }
        } else {
          setMessage('Please provide at least one variable value.')
        }
      } else {
        // No variables, send message normally
        try {
          await sendMessage(
            message,
            true,
            uploadedFiles.length > 0 ? uploadedFiles : undefined
          )
          setPrompt('')
          setUploadedFiles([])
          setMessage('')
        } catch (error) {
          console.error('Error sending message:', error)
          setMessage('Failed to send message. Please try again.')
        }
      }
    },
    [
      uploadedFiles,
      variables,
      variableCount,
      sendMessage,
      createThread,
      selectedModel?.id,
      selectedProvider,
      router,
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


  return (
    <div className={cn('relative w-full max-w-2xl mx-auto', className)}>
      <div
        className={cn(
          'relative flex flex-col w-full rounded-xl border border-main-view-fg/20 bg-main-view-fg/5 transition-all duration-200 ease-in-out shadow-sm',
          isFocused && 'border-main-view-fg/40 bg-main-view-fg/10 shadow-md'
        )}
      >
        <div className="relative flex-1">
          {uploadedFiles.length > 0 && (
            <div className="flex gap-3 items-center p-2 pb-0">
              {uploadedFiles.map((file, index) => {
                return (
                  <div
                    key={index}
                    className={cn(
                      'relative border border-main-view-fg/5 rounded-lg',
                      file.type.startsWith('image/') ? 'size-14' : 'h-14 '
                    )}
                  >
                    {file.type.startsWith('image/') && (
                      <img
                        className="object-cover w-full h-full rounded-lg"
                        src={file.dataUrl}
                        alt={`${file.name} - ${index}`}
                      />
                    )}
                    <div
                      className="absolute -top-1 -right-2.5 bg-destructive size-5 flex rounded-full items-center justify-center cursor-pointer"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <IconX className="text-destructive-fg" size={16} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {/* Removed overlay rectangles highlighting /var for cleaner UI */}
          <TextareaAutosize
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type your prompt. Use /var for variables"
            className={cn(
              'w-full resize-none border-0 bg-transparent px-4 py-4 text-main-view-fg placeholder:text-main-view-fg/50 focus:outline-none focus:ring-0 relative z-10 text-base',
              spellCheckChatInput ? '' : 'spellcheck="false"'
            )}
            maxRows={maxRows}
            minRows={1}
            onHeightChange={() => {
              // Height change handled by TextareaAutosize
            }}
          />
        </div>

        <div className="flex items-center justify-between w-full p-3 border-t border-main-view-fg/10">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center gap-2',
                streamingContent && 'opacity-50 pointer-events-none'
              )}
            >
              {/* Model selector (same as New Chat) */}
              {model?.provider === 'llamacpp' && loadingModel ? (
                <ModelLoader />
              ) : (
                <DropdownModelProvider
                  model={model}
                  useLastUsedModel={initialMessage}
                />
              )}
              {/* Vision (attachments) */}
              {hasMmproj && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1"
                        onClick={handleAttachmentClick}
                      >
                        <IconPhoto size={18} className="text-main-view-fg/50" />
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          multiple
                          onChange={handleFileChange}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Vision</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Embeddings indicator */}
              {selectedModel?.capabilities?.includes('embeddings') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1">
                        <IconCodeCircle2 size={18} className="text-main-view-fg/50" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Embeddings</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Tools dropdown */}
              {selectedModel?.capabilities?.includes('tools') &&
                (connectedServers.length > 0 || (useAppState.getState().tools || []).length > 0) && (
                  <TooltipProvider>
                    <Tooltip open={tooltipToolsAvailable} onOpenChange={setTooltipToolsAvailable}>
                      <TooltipTrigger asChild disabled={dropdownToolsAvailable}>
                        <div
                          onClick={(e) => {
                            setDropdownToolsAvailable(false)
                            e.stopPropagation()
                          }}
                        >
                          <DropdownToolsAvailable
                            initialMessage={initialMessage}
                            onOpenChange={(isOpen) => {
                              setDropdownToolsAvailable(isOpen)
                              if (isOpen) setTooltipToolsAvailable(false)
                            }}
                          >
                            {(isOpen, toolsCount) => (
                              <div
                                className={cn(
                                  'h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1 cursor-pointer relative',
                                  isOpen && 'bg-main-view-fg/10'
                                )}
                              >
                                <IconTool size={18} className="text-main-view-fg/50" />
                                {toolsCount > 0 && (
                                  <div className="absolute -top-2 -right-2 bg-accent text-accent-fg text-xs rounded-full size-5 flex items-center justify-center font-medium">
                                    <span className="leading-0 text-xs">{toolsCount > 99 ? '99+' : toolsCount}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </DropdownToolsAvailable>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tools</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              {/* Web search indicator */}
              {selectedModel?.capabilities?.includes('web_search') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1">
                        <IconWorld size={18} className="text-main-view-fg/50" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Web Search</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Reasoning indicator */}
              {selectedModel?.capabilities?.includes('reasoning') && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-7 p-1 flex items-center justify-center rounded-sm hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out gap-1">
                        <IconAtom size={18} className="text-main-view-fg/50" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reasoning</p>
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
              className="h-8 w-8"
              onClick={() =>
                // stopStreaming(currentThreadId ?? streamingContent.thread_id)
                console.log('Stop streaming')
              }
            >
              <IconPlayerStopFilled className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant={
                !prompt.trim() && uploadedFiles.length === 0
                  ? null
                  : 'default'
              }
              size="icon"
              className="h-8 w-8"
              disabled={!prompt.trim() && uploadedFiles.length === 0}
              data-test-id="send-message-button"
              onClick={() => handleSendMesage(prompt)}
            >
              {streamingContent ? (
                <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Variable Input Boxes */}
      {prompt.includes('/var') && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center gap-1 bg-main-view-fg/10 rounded-md p-1 border border-main-view-fg/20">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleVariableCountChange(variableCount - 1)}
                disabled={variableCount <= 2}
                className="h-6 w-6 p-0 hover:bg-main-view-fg/20"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <span className="text-sm font-medium w-4 text-center text-main-view-fg">
                {variableCount}
              </span>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleVariableCountChange(variableCount + 1)}
                disabled={variableCount >= 4}
                className="h-6 w-6 p-0 hover:bg-main-view-fg/20"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={saveAsMarkdownMode ? 'default' : null}
                    size="sm"
                    className={cn(
                      'h-6 px-2 py-0 text-xs rounded-sm',
                      saveAsMarkdownMode
                        ? 'bg-accent text-accent-fg'
                        : 'bg-main-view-fg/10 border border-main-view-fg/20 text-main-view-fg/80 hover:bg-main-view-fg/15'
                    )}
                    onClick={() => setSaveAsMarkdownMode((s) => !s)}
                  >
                    SAMD
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save As Markdown (Documents/BSP)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: variableCount }, (_, index) => (
              <div key={index} className="relative">
                <input
                  type="text"
                  value={variables[index] || ''}
                  onChange={(e) => handleVariableChange(index, e.target.value)}
                  placeholder={`Variable ${index + 1}`}
                  maxLength={10}
                  className="w-full px-3 py-2 text-sm bg-main-view-fg/10 border border-main-view-fg/20 rounded-md text-main-view-fg placeholder:text-main-view-fg/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all"
                />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">{index + 1}</span>
                </div>
              </div>
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
              onClick={() => {
                setMessage('')
                if (fileInputRef.current) {
                  fileInputRef.current.value = ''
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default BSPInput
