import { describe, expect, it } from 'vitest'
import { payingKit, type PaymentRequirementsResponse } from './index.js'

describe('PayingKit#getPayUrl', () => {
  it('encodes requirements into a deterministic payment URL', () => {
    const requirements1: PaymentRequirementsResponse = {
      'x402Version': 1,
      'error': 'X-PAYMENT header is required',
      'accepts': [
        {
          'scheme': 'exact',
          'network': 'base-sepolia',
          'maxAmountRequired': '10000',
          'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'payTo': '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data',
          'mimeType': 'application/json',
          'outputSchema': undefined,
          'maxTimeoutSeconds': 60,
          'extra': {
            'name': 'USDC',
            'version': '2'
          }
        }
      ]
    }

    const requirements2: PaymentRequirementsResponse = {
      'x402Version': 1,
      'error': 'X-PAYMENT header is required',
      'accepts': [
        {
          'scheme': 'exact',
          'network': 'base-sepolia',
          'maxAmountRequired': '10000',
          'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'payTo': '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data',
          'mimeType': 'application/json',
          'outputSchema': undefined,
          'maxTimeoutSeconds': 60,
          'extra': {
            'name': 'USDC',
            'version': '2'
          }
        },
        {
          'scheme': 'exact',
          'network': 'base-sepolia',
          'maxAmountRequired': '10000',
          'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'payTo': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market 1 data',
          'mimeType': 'application/json',
          'outputSchema': undefined,
          'maxTimeoutSeconds': 60,
          'extra': {
            'name': 'USDC',
            'version': '2'
          }
        },
        {
          'scheme': 'exact',
          'network': 'base-sepolia',
          'maxAmountRequired': '10000',
          'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'payTo': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market 1 data',
          'mimeType': 'application/json',
          'outputSchema': undefined,
          'maxTimeoutSeconds': 60,
          'extra': {
            'name': 'USDC',
            'version': '2'
          }
        }
      ]
    }
    const json1 = JSON.stringify(requirements1)
    console.log('Requirements 1 JSON length:', json1.length)
    const json2 = JSON.stringify(requirements2)
    console.log('Requirements 2 JSON length:', json2.length)
    const { payUrl, txid } = payingKit.getPayUrl(requirements1)
    console.log('Requirements 1 payUrl length:', payUrl.length)
    const { payUrl: payUrl2 } = payingKit.getPayUrl(requirements2)
    console.log('Requirements 2 payUrl length:', payUrl2.length)
    console.log({ payUrl, txid })
    expect(payUrl2.length < payUrl.length + 100).toBe(true)
  })
})
