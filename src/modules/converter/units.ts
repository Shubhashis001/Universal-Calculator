// Unit conversion data. Each category has a base unit; all units define factor to base.
// Temperature uses special handling. Conversions: value_in_base = value * factor; target = base / targetFactor.

export interface UnitDef { name: string; symbol: string; factor: number; }
export interface Category { id: string; name: string; units: UnitDef[]; }

export const categories: Category[] = [
  {
    id: 'length', name: 'Length', units: [
      { name: 'Meter', symbol: 'm', factor: 1 },
      { name: 'Kilometer', symbol: 'km', factor: 1000 },
      { name: 'Centimeter', symbol: 'cm', factor: 0.01 },
      { name: 'Millimeter', symbol: 'mm', factor: 0.001 },
      { name: 'Micrometer', symbol: 'µm', factor: 1e-6 },
      { name: 'Nanometer', symbol: 'nm', factor: 1e-9 },
      { name: 'Mile', symbol: 'mi', factor: 1609.344 },
      { name: 'Yard', symbol: 'yd', factor: 0.9144 },
      { name: 'Foot', symbol: 'ft', factor: 0.3048 },
      { name: 'Inch', symbol: 'in', factor: 0.0254 },
      { name: 'Nautical mile', symbol: 'nmi', factor: 1852 },
      { name: 'Light year', symbol: 'ly', factor: 9.4607e15 },
    ],
  },
  {
    id: 'area', name: 'Area', units: [
      { name: 'Square meter', symbol: 'm²', factor: 1 },
      { name: 'Square kilometer', symbol: 'km²', factor: 1e6 },
      { name: 'Square centimeter', symbol: 'cm²', factor: 1e-4 },
      { name: 'Hectare', symbol: 'ha', factor: 1e4 },
      { name: 'Acre', symbol: 'ac', factor: 4046.8564224 },
      { name: 'Square mile', symbol: 'mi²', factor: 2.589988110336e6 },
      { name: 'Square foot', symbol: 'ft²', factor: 0.09290304 },
      { name: 'Square inch', symbol: 'in²', factor: 0.00064516 },
      { name: 'Square yard', symbol: 'yd²', factor: 0.83612736 },
    ],
  },
  {
    id: 'volume', name: 'Volume', units: [
      { name: 'Liter', symbol: 'L', factor: 1 },
      { name: 'Milliliter', symbol: 'mL', factor: 0.001 },
      { name: 'Cubic meter', symbol: 'm³', factor: 1000 },
      { name: 'Cubic centimeter', symbol: 'cm³', factor: 0.001 },
      { name: 'Gallon (US)', symbol: 'gal', factor: 3.785411784 },
      { name: 'Quart (US)', symbol: 'qt', factor: 0.946352946 },
      { name: 'Pint (US)', symbol: 'pt', factor: 0.473176473 },
      { name: 'Cup (US)', symbol: 'cup', factor: 0.2365882365 },
      { name: 'Fluid ounce (US)', symbol: 'fl oz', factor: 0.0295735295625 },
      { name: 'Tablespoon', symbol: 'tbsp', factor: 0.01478676478125 },
      { name: 'Teaspoon', symbol: 'tsp', factor: 0.00492892159375 },
    ],
  },
  {
    id: 'mass', name: 'Mass', units: [
      { name: 'Kilogram', symbol: 'kg', factor: 1 },
      { name: 'Gram', symbol: 'g', factor: 0.001 },
      { name: 'Milligram', symbol: 'mg', factor: 1e-6 },
      { name: 'Metric ton', symbol: 't', factor: 1000 },
      { name: 'Pound', symbol: 'lb', factor: 0.45359237 },
      { name: 'Ounce', symbol: 'oz', factor: 0.028349523125 },
      { name: 'Stone', symbol: 'st', factor: 6.35029318 },
      { name: 'US ton', symbol: 'ton', factor: 907.18474 },
      { name: 'Carat', symbol: 'ct', factor: 0.0002 },
    ],
  },
  {
    id: 'time', name: 'Time', units: [
      { name: 'Second', symbol: 's', factor: 1 },
      { name: 'Millisecond', symbol: 'ms', factor: 0.001 },
      { name: 'Microsecond', symbol: 'µs', factor: 1e-6 },
      { name: 'Nanosecond', symbol: 'ns', factor: 1e-9 },
      { name: 'Minute', symbol: 'min', factor: 60 },
      { name: 'Hour', symbol: 'h', factor: 3600 },
      { name: 'Day', symbol: 'd', factor: 86400 },
      { name: 'Week', symbol: 'wk', factor: 604800 },
      { name: 'Month (avg)', symbol: 'mo', factor: 2629800 },
      { name: 'Year (avg)', symbol: 'yr', factor: 31557600 },
    ],
  },
  {
    id: 'speed', name: 'Speed', units: [
      { name: 'Meter/second', symbol: 'm/s', factor: 1 },
      { name: 'Kilometer/hour', symbol: 'km/h', factor: 0.277777778 },
      { name: 'Mile/hour', symbol: 'mph', factor: 0.44704 },
      { name: 'Foot/second', symbol: 'ft/s', factor: 0.3048 },
      { name: 'Knot', symbol: 'kn', factor: 0.514444444 },
      { name: 'Mach (sea level)', symbol: 'Mach', factor: 343 },
    ],
  },
  {
    id: 'data', name: 'Data Storage', units: [
      { name: 'Bit', symbol: 'b', factor: 1 },
      { name: 'Byte', symbol: 'B', factor: 8 },
      { name: 'Kilobit', symbol: 'kb', factor: 1000 },
      { name: 'Kilobyte', symbol: 'KB', factor: 8000 },
      { name: 'Megabit', symbol: 'Mb', factor: 1e6 },
      { name: 'Megabyte', symbol: 'MB', factor: 8e6 },
      { name: 'Gigabit', symbol: 'Gb', factor: 1e9 },
      { name: 'Gigabyte', symbol: 'GB', factor: 8e9 },
      { name: 'Terabyte', symbol: 'TB', factor: 8e12 },
      { name: 'Petabyte', symbol: 'PB', factor: 8e15 },
      { name: 'Kibibyte', symbol: 'KiB', factor: 8192 },
      { name: 'Mebibyte', symbol: 'MiB', factor: 8388608 },
      { name: 'Gibibyte', symbol: 'GiB', factor: 8589934592 },
    ],
  },
  {
    id: 'pressure', name: 'Pressure', units: [
      { name: 'Pascal', symbol: 'Pa', factor: 1 },
      { name: 'Kilopascal', symbol: 'kPa', factor: 1000 },
      { name: 'Bar', symbol: 'bar', factor: 100000 },
      { name: 'PSI', symbol: 'psi', factor: 6894.757293168 },
      { name: 'Atmosphere', symbol: 'atm', factor: 101325 },
      { name: 'Torr', symbol: 'Torr', factor: 133.322368421 },
      { name: 'mmHg', symbol: 'mmHg', factor: 133.322387415 },
    ],
  },
  {
    id: 'energy', name: 'Energy', units: [
      { name: 'Joule', symbol: 'J', factor: 1 },
      { name: 'Kilojoule', symbol: 'kJ', factor: 1000 },
      { name: 'Calorie', symbol: 'cal', factor: 4.184 },
      { name: 'Kilocalorie', symbol: 'kcal', factor: 4184 },
      { name: 'Watt hour', symbol: 'Wh', factor: 3600 },
      { name: 'Kilowatt hour', symbol: 'kWh', factor: 3.6e6 },
      { name: 'Electronvolt', symbol: 'eV', factor: 1.602176634e-19 },
      { name: 'BTU', symbol: 'BTU', factor: 1055.05585262 },
      { name: 'Foot-pound', symbol: 'ft·lb', factor: 1.3558179483314 },
    ],
  },
  {
    id: 'power', name: 'Power', units: [
      { name: 'Watt', symbol: 'W', factor: 1 },
      { name: 'Kilowatt', symbol: 'kW', factor: 1000 },
      { name: 'Megawatt', symbol: 'MW', factor: 1e6 },
      { name: 'Horsepower', symbol: 'hp', factor: 745.69987158227 },
      { name: 'Horsepower (metric)', symbol: 'PS', factor: 735.49875 },
      { name: 'BTU/hour', symbol: 'BTU/h', factor: 0.29307107017 },
    ],
  },
  {
    id: 'angle', name: 'Angle', units: [
      { name: 'Degree', symbol: '°', factor: 1 },
      { name: 'Radian', symbol: 'rad', factor: 57.2957795131 },
      { name: 'Gradian', symbol: 'grad', factor: 0.9 },
      { name: 'Arcminute', symbol: '′', factor: 0.0166666667 },
      { name: 'Arcsecond', symbol: '″', factor: 0.000277777778 },
      { name: 'Revolution', symbol: 'rev', factor: 360 },
    ],
  },
  {
    id: 'frequency', name: 'Frequency', units: [
      { name: 'Hertz', symbol: 'Hz', factor: 1 },
      { name: 'Kilohertz', symbol: 'kHz', factor: 1000 },
      { name: 'Megahertz', symbol: 'MHz', factor: 1e6 },
      { name: 'Gigahertz', symbol: 'GHz', factor: 1e9 },
      { name: 'RPM', symbol: 'rpm', factor: 0.0166666667 },
    ],
  },
  {
    id: 'force', name: 'Force', units: [
      { name: 'Newton', symbol: 'N', factor: 1 },
      { name: 'Kilonewton', symbol: 'kN', factor: 1000 },
      { name: 'Dyne', symbol: 'dyn', factor: 1e-5 },
      { name: 'Pound-force', symbol: 'lbf', factor: 4.4482216152605 },
      { name: 'Kilogram-force', symbol: 'kgf', factor: 9.80665 },
    ],
  },
  {
    id: 'acceleration', name: 'Acceleration', units: [
      { name: 'Meter/sec²', symbol: 'm/s²', factor: 1 },
      { name: 'Gal', symbol: 'Gal', factor: 0.01 },
      { name: 'Standard gravity', symbol: 'g', factor: 9.80665 },
      { name: 'Foot/sec²', symbol: 'ft/s²', factor: 0.3048 },
    ],
  },
  {
    id: 'fuel', name: 'Fuel Economy', units: [
      { name: 'km/L', symbol: 'km/L', factor: 1 },
      { name: 'L/100km', symbol: 'L/100km', factor: -1 },
      { name: 'MPG (US)', symbol: 'mpg', factor: 0.4251437075 },
      { name: 'MPG (UK)', symbol: 'mpg-uk', factor: 0.35400604 },
    ],
  },
];

// Temperature handled specially
export const tempUnits = [
  { name: 'Celsius', symbol: '°C' },
  { name: 'Fahrenheit', symbol: '°F' },
  { name: 'Kelvin', symbol: 'K' },
  { name: 'Rankine', symbol: '°R' },
];

export function convertTemp(value: number, from: string, to: string): number {
  let c: number;
  switch (from) {
    case 'Celsius': c = value; break;
    case 'Fahrenheit': c = (value - 32) * 5 / 9; break;
    case 'Kelvin': c = value - 273.15; break;
    case 'Rankine': c = (value - 491.67) * 5 / 9; break;
    default: c = value;
  }
  switch (to) {
    case 'Celsius': return c;
    case 'Fahrenheit': return c * 9 / 5 + 32;
    case 'Kelvin': return c + 273.15;
    case 'Rankine': return (c + 273.15) * 9 / 5;
    default: return c;
  }
}
