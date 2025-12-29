import React, { useState } from 'react';
import { Flex, Box, Text, Tooltip } from '@chakra-ui/react';
import { Star } from 'lucide-react';

interface Question {
  id: number;
  text: string;
  B5T?: string;
}

interface SurveyProps {
  questions: Question[];
  currentPromptB5T: string;
  onSurveyComplete: (responses: any) => void;
  index: number;
}

export default function Survey({
  questions,
  currentPromptB5T,
  onSurveyComplete,
  index,
}: SurveyProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<any>({});
  const [hoverIndex, setHoverIndex] = useState(-1);

  const handleResponse = (rating: number) => {
    const question = questions[currentQuestionIndex];
    const newResponses = {
      ...responses,
      [question.id]: {
        rating: rating,
        question: question.text,
        B5T: question?.B5T,
      },
    };
    setResponses(newResponses);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onSurveyComplete(newResponses);
    }
  };

  const renderStars = () => {
    const labels = [
      'Strongly Disagree',
      'Disagree',
      'Neutral',
      'Agree',
      'Strongly Agree',
    ];
    const rating = responses[questions[currentQuestionIndex].id]?.rating || 0;
    return labels.map((label, starIndex) => (
      <Tooltip.Root key={starIndex}>
        <Tooltip.Trigger asChild>
          <Box
            as="span"
            display="inline-flex"
            m={1}
            color={
              starIndex <= (hoverIndex >= 0 ? hoverIndex : rating - 1)
                ? 'orange.400'
                : 'gray.300'
            }
            onClick={() => handleResponse(starIndex + 1)}
            onMouseEnter={() => setHoverIndex(starIndex)}
            onMouseLeave={() => setHoverIndex(-1)}
            cursor="pointer"
            _hover={{
              color: 'orange.600',
              transform: 'scale(1.1)',
              transition: 'transform 0.2s ease-in-out',
            }}
          >
            <Star size={40} fill="currentColor" />
          </Box>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
    ));
  };

  return (
    <Flex
      justifyContent="center"
      alignItems="center"
      position="fixed"
      bottom="0"
      w="full"
      p={4}
      bgColor="gray.100"
    >
      <Text fontSize="xl" fontFamily="Avenir" fontWeight="bold" mr={4}>
        {questions[currentQuestionIndex].text}
      </Text>
      {renderStars()}
    </Flex>
  );
}
