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
          'network': 'solana',
          'maxAmountRequired': '5000000',
          'asset': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          'payTo': '45FWyVsWLVUKyAdGwFaeDvxwYnQGoBshfoJAm6fhoECX',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data 1',
          'mimeType': 'application/json',
          'maxTimeoutSeconds': 60,
          'extra': {
            'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'
          }
        },
        {
          'scheme': 'exact',
          'network': 'solana-devnet',
          'maxAmountRequired': '5000000',
          'asset': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
          'payTo': '45FWyVsWLVUKyAdGwFaeDvxwYnQGoBshfoJAm6fhoECX',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data 1',
          'mimeType': 'application/json',
          'maxTimeoutSeconds': 60,
          'extra': {
            'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'
          }
        },
        {
          'scheme': 'exact',
          'network': 'solana',
          'maxAmountRequired': '5000000',
          'asset': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
          'payTo': '45FWyVsWLVUKyAdGwFaeDvxwYnQGoBshfoJAm6fhoECX',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data 2',
          'mimeType': 'application/json',
          'maxTimeoutSeconds': 60,
          'extra': {
            'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'
          }
        },
        {
          'scheme': 'exact',
          'network': 'solana',
          'maxAmountRequired': '50000000',
          'asset': 'So11111111111111111111111111111111111111111',
          'payTo': '45FWyVsWLVUKyAdGwFaeDvxwYnQGoBshfoJAm6fhoECX',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data 3',
          'mimeType': 'application/json',
          'maxTimeoutSeconds': 60,
          'extra': {
            'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'
          }
        },
        {
          'scheme': 'exact',
          'network': 'solana',
          'maxAmountRequired': '5000000000',
          'asset': 'PAYiNGqaLFRdBomkQY3JXZeCm7wzK7hKuhrJDzcZBWN',
          'payTo': '45FWyVsWLVUKyAdGwFaeDvxwYnQGoBshfoJAm6fhoECX',
          'resource': 'https://api.example.com/premium-data',
          'description': 'Access to premium market data 4',
          'mimeType': 'application/json',
          'maxTimeoutSeconds': 60,
          'extra': {
            'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'
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
    console.log({ payUrl2, txid })
    expect(payUrl2.length < payUrl.length * 2).toBe(true)
  })
})
