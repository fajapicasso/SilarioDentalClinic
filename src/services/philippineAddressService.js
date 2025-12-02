// src/services/philippineAddressService.js - Philippine Address Service using GitHub API

/**
 * Philippine Address Service
 * Uses free public API from GitHub
 * Complete data for all 81 provinces, 1,634 cities/municipalities, and 42,046 barangays
 */

const PH_API_URL = 'https://raw.githubusercontent.com/flores-jacob/philippine-regions-provinces-cities-municipalities-barangays/master/philippine_provinces_cities_municipalities_and_barangays_2019v2.json';

// Cache for API data
let cachedData = null;
let isDataLoading = false;
let dataLoadPromise = null;

export class PhilippineAddressService {
  /**
   * Load Philippine address data from GitHub API
   * @returns {Promise<Object>} - Address data
   */
  static async loadData() {
    // Return cached data if available
    if (cachedData) {
      return cachedData;
    }

    // Return existing promise if already loading
    if (isDataLoading && dataLoadPromise) {
      return dataLoadPromise;
    }

    // Create new loading promise
    isDataLoading = true;
    dataLoadPromise = fetch(PH_API_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('✅ Successfully loaded Philippine address data');
        cachedData = data;
        isDataLoading = false;
        return data;
      })
      .catch(error => {
        console.error('❌ Error loading Philippine address data:', error);
        isDataLoading = false;
        throw error;
      });

    return dataLoadPromise;
  }

  /**
   * Get all provinces
   * @returns {Promise<Array>} - Array of province names
   */
  static async getProvinces() {
    try {
      const data = await this.loadData();
      console.log('🔍 Data structure keys:', Object.keys(data));
      
      // Data structure: { "01": { region_name: "...", province_list: {...} }, ... }
      const provinces = new Set();
      
      // Iterate through all regions
      Object.values(data).forEach(region => {
        if (region.province_list) {
          Object.keys(region.province_list).forEach(province => {
            // Convert from ALL CAPS to Title Case
            const titleCaseProvince = province.split(' ').map(word => 
              word.charAt(0) + word.slice(1).toLowerCase()
            ).join(' ');
            provinces.add(titleCaseProvince);
          });
        }
      });
      
      const provinceArray = Array.from(provinces).sort();
      console.log(`✅ Loaded ${provinceArray.length} provinces`);
      return provinceArray;
    } catch (error) {
      console.error('Error getting provinces:', error);
      // Return fallback provinces
      return ['Ilocos Sur', 'La Union', 'Benguet'];
    }
  }

  /**
   * Get municipalities/cities for a specific province
   * @param {string} province - Province name
   * @returns {Promise<Array>} - Array of municipality/city names
   */
  static async getMunicipalities(province) {
    try {
      const data = await this.loadData();
      
      // Convert province to ALL CAPS for lookup
      const provinceKey = province.toUpperCase();
      
      // Search through all regions for the province
      for (const region of Object.values(data)) {
        if (region.province_list && region.province_list[provinceKey]) {
          const municipalityList = region.province_list[provinceKey].municipality_list || {};
          const municipalities = Object.keys(municipalityList).map(municipality => {
            // Convert from ALL CAPS to Title Case
            return municipality.split(' ').map(word => 
              word.charAt(0) + word.slice(1).toLowerCase()
            ).join(' ');
          });
          console.log(`✅ Loaded ${municipalities.length} municipalities for ${province}`);
          return municipalities.sort();
        }
      }
      
      console.warn(`⚠️ No municipalities found for province: ${province}`);
      return [];
    } catch (error) {
      console.error('Error getting municipalities for', province, ':', error);
      return [];
    }
  }

  /**
   * Get barangays for a specific province and municipality
   * @param {string} province - Province name
   * @param {string} municipality - Municipality/city name
   * @returns {Promise<Array>} - Array of barangay names
   */
  static async getBarangays(province, municipality) {
    try {
      const data = await this.loadData();
      
      // Convert to ALL CAPS for lookup
      const provinceKey = province.toUpperCase();
      const municipalityKey = municipality.toUpperCase();
      
      // Search through all regions for the province and municipality
      for (const region of Object.values(data)) {
        if (region.province_list && region.province_list[provinceKey]) {
          const provinceData = region.province_list[provinceKey];
          if (provinceData.municipality_list && provinceData.municipality_list[municipalityKey]) {
            const municipalityData = provinceData.municipality_list[municipalityKey];
            if (municipalityData.barangay_list && Array.isArray(municipalityData.barangay_list)) {
              const barangays = municipalityData.barangay_list.map(barangay => {
                // Convert from ALL CAPS to Title Case
                return barangay.split(' ').map(word => 
                  word.charAt(0) + word.slice(1).toLowerCase()
                ).join(' ');
              });
              console.log(`✅ Loaded ${barangays.length} barangays for ${municipality}`);
              return barangays.sort();
            }
          }
        }
      }
      
      console.warn(`⚠️ No barangays found for ${municipality}, ${province}`);
      return [];
    } catch (error) {
      console.error('Error getting barangays for', municipality, ':', error);
      return [];
    }
  }

  /**
   * Validate if a province exists
   * @param {string} province - Province name
   * @returns {Promise<boolean>} - True if province exists
   */
  static async isValidProvince(province) {
    try {
      const provinces = await this.getProvinces();
      return provinces.includes(province);
    } catch (error) {
      console.error('Error validating province:', error);
      return false;
    }
  }

  /**
   * Validate if a municipality exists in a province
   * @param {string} province - Province name
   * @param {string} municipality - Municipality name
   * @returns {Promise<boolean>} - True if municipality exists in province
   */
  static async isValidMunicipality(province, municipality) {
    try {
      const municipalities = await this.getMunicipalities(province);
      return municipalities.includes(municipality);
    } catch (error) {
      console.error('Error validating municipality:', error);
      return false;
    }
  }

  /**
   * Validate if a barangay exists in a municipality
   * @param {string} province - Province name
   * @param {string} municipality - Municipality name
   * @param {string} barangay - Barangay name
   * @returns {Promise<boolean>} - True if barangay exists in municipality
   */
  static async isValidBarangay(province, municipality, barangay) {
    try {
      const barangays = await this.getBarangays(province, municipality);
      return barangays.includes(barangay);
    } catch (error) {
      console.error('Error validating barangay:', error);
      return false;
    }
  }
}

export default PhilippineAddressService;
