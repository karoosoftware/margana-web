import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SignUpForm from '../SignUpForm.vue'
import { createRouter, createWebHistory } from 'vue-router'

// Mock router
const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: { template: '<div></div>' } }]
})

describe('SignUpForm', () => {
  it('renders email input as editable by default', () => {
    const wrapper = mount(SignUpForm, {
      props: {
        email: 'test@example.com',
        step: 1
      },
      global: {
        plugins: [router]
      }
    })
    
    const emailInput = wrapper.find('#signup-email')
    expect(emailInput.attributes('readonly')).toBeUndefined()
    expect(emailInput.classes()).not.toContain('opacity-60')
  })

  it('renders email input as readonly when emailLocked is true', () => {
    const wrapper = mount(SignUpForm, {
      props: {
        email: 'test@example.com',
        step: 1,
        emailLocked: true
      },
      global: {
        plugins: [router]
      }
    })
    
    const emailInput = wrapper.find('#signup-email')
    // Vue 3 @vue/test-utils attributes() returns an empty string for boolean attributes like readonly
    expect(emailInput.attributes('readonly')).toBeDefined()
    expect(emailInput.classes()).toContain('opacity-60')
  })

  it('disables the "Create account" button until all fields are filled and terms accepted', async () => {
    const wrapper = mount(SignUpForm, {
      props: {
        email: 'test@example.com',
        step: 1
      },
      global: {
        plugins: [router]
      }
    })

    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()

    // Fill in fields
    await wrapper.find('#signup-given').setValue('John')
    await wrapper.find('#signup-family').setValue('Doe')
    await wrapper.find('#signup-password').setValue('password123')
    
    // Still disabled because terms are not accepted
    expect(button.attributes('disabled')).toBeDefined()

    // Accept terms
    await wrapper.find('input[type="checkbox"]').setValue(true)
    
    // Should be enabled now
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('disables the "Confirm account" button until code is entered', async () => {
    const wrapper = mount(SignUpForm, {
      props: {
        email: 'test@example.com',
        step: 2
      },
      global: {
        plugins: [router]
      }
    })

    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.find('#signup-code').setValue('123456')
    expect(button.attributes('disabled')).toBeUndefined()
  })
})
