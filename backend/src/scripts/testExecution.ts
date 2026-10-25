import { CodeExecutionService } from '../services/execution.service.js';

async function main() {
  console.log('Testing C++ compiler with STL and Vectors...');
  const cppCode1 = `
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> nums = {42, 17, 89, 5};
    std::sort(nums.begin(), nums.end());
    for (int n : nums) {
        std::cout << n << " ";
    }
    std::cout << std::endl;
    return 0;
}
  `;
  const result1 = await CodeExecutionService.execute('cpp', cppCode1);
  console.log('Result 1 (STL Vector & Sort):', result1.status, 'Output:', result1.stdout.trim());

  console.log('Testing C++ with cin and stdin...');
  const cppCode2 = `
#include <iostream>
#include <string>

int main() {
    std::string name;
    int score;
    if (std::cin >> name >> score) {
        std::cout << "User: " << name << ", Score: " << (score * 2) << std::endl;
    } else {
        std::cout << "No input provided" << std::endl;
    }
    return 0;
}
  `;
  const result2 = await CodeExecutionService.execute('cpp', cppCode2, 'Alice 50');
  console.log('Result 2 (cin):', result2.status, 'Output:', result2.stdout.trim());
}

main();

