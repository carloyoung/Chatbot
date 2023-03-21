<script lang="ts">
	import ChatMessage from '$lib/components/ChatMessage.svelte'
	import type { ChatCompletionRequestMessage } from 'openai'
	import { SSE } from 'sse.js'

	let query: string = ''
	let answer: string = ''
	let loading: boolean = false
	let chatMessages: ChatCompletionRequestMessage[] = []
	let scrollToDiv: HTMLDivElement

	function scrollToBottom() {
		setTimeout(function () {
			scrollToDiv.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
		}, 100)
	}

	const handleSubmit = async () => {
		loading = true
		chatMessages = [...chatMessages, { role: 'user', content: query }]

		const eventSource = new SSE('/api/chat', {
			headers: {
				'Content-Type': 'application/json'
			},
			payload: JSON.stringify({ messages: chatMessages })
		})

		query = ''

		eventSource.addEventListener('error', handleError)

		eventSource.addEventListener('message', (e) => {
			scrollToBottom()
			try {
				loading = false
				if (e.data === '[DONE]') {
					chatMessages = [...chatMessages, { role: 'assistant', content: answer }]
					answer = ''
					return
				}

				const completionResponse = JSON.parse(e.data)
				const [{ delta }] = completionResponse.choices

				if (delta.content) {
					answer = (answer ?? '') + delta.content
				}
			} catch (err) {
				handleError(err)
			}
		})
		eventSource.stream()
		scrollToBottom()
	}

	function handleError<T>(err: T) {
		loading = false
		query = ''
		answer = ''
		console.error(err)
	}
</script>

<div class="flex flex-col pt-4 w-full px-8 items-center gap-2 mt-10 rounded-md" style="background-color: #ffffff; color: #0c3e5f;">
	<div class="flex flex-col items-center justify-center gap-2">
		<h1 class="text-4xl font-bold text-center" style="color: #003a6c;">Kroger Grocery</h1>
		<p class="text-lg italic text-center">Your virtual shopping assistant powered by gpt-3.5-turbo</p>
	</div>
	<div class="h-[500px] w-full bg-blue-500 rounded-md p-4 overflow-y-auto flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<ChatMessage type="assistant" message="Hi there, I'm Catalina, your virtual assistant at Kroger Grocery. How can I help you today?" />
			{#each chatMessages as message}
				<ChatMessage type={message.role} message={message.content} />
			{/each}
			{#if answer}
				<ChatMessage type="assistant" message={answer} />
			{/if}
			{#if loading}
				<ChatMessage type="assistant" message="....." />
			{/if}
		</div>
		<div class="" bind:this={scrollToDiv} />
	</div>
	<form
	class="flex w-full rounded-md gap-4 bg-blue-500 p-4 mb-8"
		on:submit|preventDefault={() => handleSubmit()}
	>
		<input type="text" class="input input-bordered w-full text-xl" placeholder="Ask me anything about Kroger Grocery" bind:value={query} style="color: #ffffff; background-color: #0c3e5f;" />
		<button type="submit" class="btn btn-accent" style="background-color: #003a6c;"> Send </button>
	</form>
</div>

