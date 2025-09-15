'use client'

import TextareaAutosize from 'react-textarea-autosize'
import { cn } from '@/lib/utils'
import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, ChevronUp, ChevronDown } from 'lucide-react'
import {
  IconPlayerStopFilled,
  IconX,
} from '@tabler/icons-react'
import { useGeneralSetting } from '@/hooks/useGeneralSetting'
import { useAppState } from '@/hooks/useAppState'
import { useChat } from '@/hooks/useChat'
import { useThreads } from '@/hooks/useThreads'
import { useRouter } from '@tanstack/react-router'
import { route } from '@/constants/routes'

type BSPInputProps = {
  className?: string
  showSpeedToken?: boolean
  model?: ThreadModel
  initialMessage?: boolean
}

const BSPInput = ({ className, model }: BSPInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [variables, setVariables] = useState<string[]>(['', '', '', ''])
  const [variableCount, setVariableCount] = useState(2)
  const [message, setMessage] = useState('')
  // Batch processing handled sequentially via await, no extra state
  
  const { streamingContent } = useAppState()
  const { spellCheckChatInput } = useGeneralSetting()

  const maxRows = 10

  const { sendMessage } = useChat()
  const { createThread } = useThreads()
  const router = useRouter()
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      name: string
      type: string
      size: number
      base64: string
      dataUrl: string
    }>
  >([])

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
                await sendMessage(msg)
              } else {
                const newThread = await createThread(
                  {
                    id: model?.id ?? 'gpt-4o-mini',
                    provider: model?.provider ?? 'openai',
                  },
                  `BSP Variation ${i + 1}`
                )
                await router.navigate({
                  to: route.threadsDetail,
                  params: { threadId: newThread.id },
                })
                await sendMessage(msg)
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
          await sendMessage(message)
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
      model?.id,
      model?.provider,
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
          {/* Removed overlay rectangles highlighting /var for cleaner UI */}
          <TextareaAutosize
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask gpt-4o-mini. Use /var for variables"
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
              {/* Model indicator */}
              <div className="flex items-center gap-2 px-2 py-1 bg-main-view-fg/10 rounded-md">
                <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-sm text-main-view-fg/70 font-medium">
                  gpt-4o-mini
                </span>
                <div className="w-4 h-4 p-0.5 hover:bg-main-view-fg/20 rounded cursor-pointer transition-colors">
                  <svg className="w-full h-full text-main-view-fg/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
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
          <div className="flex items-center justify-end">
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
              onClick={() => setMessage('')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default BSPInput
