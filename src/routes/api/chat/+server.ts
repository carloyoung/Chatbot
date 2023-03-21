import { OPENAI_KEY } from '$env/static/private'
import type { CreateChatCompletionRequest, ChatCompletionRequestMessage } from 'openai'
import type { RequestHandler } from './$types'
import { getTokens } from '$lib/tokenizer'
import { json } from '@sveltejs/kit'
import type { Config } from '@sveltejs/adapter-vercel'

export const config: Config = {
	runtime: 'edge'
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!OPENAI_KEY) {
			throw new Error('OPENAI_KEY env variable not set')
		}

		const requestData = await request.json()

		if (!requestData) {
			throw new Error('No request data')
		}

		const reqMessages: ChatCompletionRequestMessage[] = requestData.messages

		if (!reqMessages) {
			throw new Error('no messages provided')
		}

		let tokenCount = 0

		reqMessages.forEach((msg) => {
			const tokens = getTokens(msg.content)
			tokenCount += tokens
		})

		const moderationRes = await fetch('https://api.openai.com/v1/moderations', {
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENAI_KEY}`
			},
			method: 'POST',
			body: JSON.stringify({
				input: reqMessages[reqMessages.length - 1].content
			})
		})

		const moderationData = await moderationRes.json()
		const [results] = moderationData.results

		if (results.flagged) {
			throw new Error('Query flagged by openai')
		}

		const prompt =
			'You are a virtual assistant for a company called Kroger. Your name is Catalina. Your task is to assist customers throughout their shopping by having a access to a virtual shopping cart. Customers can ask you about availability, price, ingredients, and nutrional information of specific products. Get the prices from https://www.kroger.com/. Customers can you ask you for the location of the nearest Kroger Store, hours of operations and contact information. Customers can inquire about the status of their online orders. Customers can inquire about Kroger Rewards Program, including point accumulation and redemption options. Before checkout, you should ask the customer if they are already part of the rewards program, if not offer them the rewards program by asking for their phone number. You manage the shopping for customers by managing their virtual shopping cart. Customers can ask about current promotions, discount codes and coupon policies. Customers can provide a feedback and file complaints which can be used to improve service. Customers can receive suggestions for recipes and meal planning based on dietary restrictions, prefereces and available ingredients. You are also responsible for payments, ask the customer if they are ready to checkout. You should also upsell and cross-sell every chance you have. You should also make a breakdown of products if the customer gives a recipe. You can only answer questions about Kroger. You cannot tell the customer to redirect them to the website. Apple is $5.00. Orange is $3.00. One box of apple is 12 pieces and is $20.00. One box of orange is 12 pieces and is $30.00. You have access to the customer personal shopping cart.'
		tokenCount += getTokens(prompt)

		if (tokenCount >= 4000) {
			throw new Error('Query too large')
		}

		const messages: ChatCompletionRequestMessage[] = [
			{ role: 'system', content: prompt },
			...reqMessages
		]

		const chatRequestOpts: CreateChatCompletionRequest = {
			model: 'gpt-3.5-turbo',
			messages,
			temperature: 0.9,
			stream: true
		}

		const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
			headers: {
				Authorization: `Bearer ${OPENAI_KEY}`,
				'Content-Type': 'application/json'
			},
			method: 'POST',
			body: JSON.stringify(chatRequestOpts)
		})

		if (!chatResponse.ok) {
			const err = await chatResponse.json()
			throw new Error(err)
		}

		return new Response(chatResponse.body, {
			headers: {
				'Content-Type': 'text/event-stream'
			}
		})
	} catch (err) {
		console.error(err)
		return json({ error: 'There was an error processing your request' }, { status: 500 })
	}
}
